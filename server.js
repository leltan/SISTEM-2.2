require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const xss = require('xss');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('ERRO: a variável JWT_SECRET não está definida (no Render: aba Environment).');
    process.exit(1);
}

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ===== ARQUIVOS PÚBLICOS =====
// Só estes arquivos ficam disponíveis no navegador (o resto da pasta do projeto fica protegido).
['index.html', 'script.js', 'style.css'].forEach(nome => {
    app.get('/' + nome, (req, res) => res.sendFile(path.join(__dirname, nome)));
});
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.use('/img', express.static(path.join(__dirname, 'img')));

// ===== REGRAS DE ACESSO POR EMPRESA =====
const frotaFervima = ['677', '678', '679', '680', '681', '682', '683', '684', '686', '687', '688', '689', '690', '691', '692', '693', '694', '695', '697', '698', '699', '700', '701', '702', '703', '704', '705', '706', '707', '708', '709', '710', '711', '712', '714', '715', '716', '717', '718', '719', '720', '721', '722', '723', '724', '725', '726', '727', '728', '729', '730', '731', '732', '733'];
const frotaPirajucara = ['868', '869', '870', '871', '872', '873', '875', '877', '879', '880', '881', '882', '883', '884', '885', '886', '887', '888', '889', '890', '891', '892', '893', '894', '895', '896', '897', '898', '899', '900', '901', '902', '903', '904', '906', '907', '908', '910', '911', '912', '913'];
const frotaCDA = [
    '3001', '3002', '3003', '3004', '3006', '3007', '3008', '3009', '3010', '3011', '3012',
    '3013', '3014', '3015', '3016', '3017', '3018', '3019', '3020', '3021', '3022', '3023',
    '3024', '3025', '3026', '3027', '3028', '3029', '3030', '3031', '3032', '3100', '3101',
    '3102', '3103', '3104', '3105', '3106', '3107', '3108', '3109', '3110', '3111', '3112',
    '3113', '3114', '3115', '3116', '3117', '3118', '3119', '3120', '3121', '3122', '3123',
    '3124', '3125', '3126', '3127', '3128', '3129', '3130', '3131', '3132', '3133', '3134',
    '3135', '3136', '3137', '3138', '3139'
];

const linhasFervima = ['Circular 02', 'Circular 03', 'Circular 04', 'Circular 07.1', 'Circular 07.2', 'Circular 08'];
const linhasPirajucara = ['Circular 05', 'Circular 06', 'Circular 09', 'Circular 09.1'];
const linhasCDA = [
    'LINHA 01', 'LINHA 100', 'LINHA 01B', 'LINHA 01I', 'LINHA 02', 'LINHA 02A', 'LINHA 02B',
    'LINHA 02C', 'LINHA 02CI', 'LINHA 02D', 'LINHA 02DI', 'LINHA 03', 'LINHA 03A', 'LINHA 03CI',
    'LINHA 03I', 'LINHA 03/06', 'LINHA 04', 'LINHA 04A', 'LINHA 04HI', 'LINHA 05', 'LINHA 05I',
    'LINHA 06', 'LINHA 06A', 'LINHA 06AI', 'LINHA 06I', 'LINHA 07', 'LINHA 07A', 'LINHA 07I'
];

const EMPRESAS = {
    'Fervima': { nome: 'Viação Fervima', prefixos: frotaFervima, linhas: linhasFervima },
    'Pirajuçara': { nome: 'Viação Pirajuçara', prefixos: frotaPirajucara, linhas: linhasPirajucara },
    'CDA': { nome: 'Viação Cidade das Artes', prefixos: frotaCDA, linhas: linhasCDA }
};
const TODAS_EMPRESAS = Object.keys(EMPRESAS);

// Empresas que o usuário enxerga. Admin vê todas. A CDA é de todos.
function empresasDoUsuario(u) {
    if (u.role === 'admin') return [...TODAS_EMPRESAS];
    const lista = Array.isArray(u.empresas_permitidas) ? u.empresas_permitidas : [];
    const validas = lista.filter(e => TODAS_EMPRESAS.includes(e));
    if (!validas.includes('CDA')) validas.push('CDA');
    return [...new Set(validas)];
}

// Ocorrências antigas de Desvio ficaram como "Operacional": só o grupo Pirajuçara vê.
function podeVerEmpresa(usuario, empresa) {
    if (usuario.role === 'admin') return true;
    if (empresa === 'Operacional') {
        return usuario.empresas.includes('Fervima') || usuario.empresas.includes('Pirajuçara');
    }
    return usuario.empresas.includes(empresa);
}

function empresaDoPrefixo(prefixo) {
    const p = String(prefixo || '').trim();
    return TODAS_EMPRESAS.find(e => EMPRESAS[e].prefixos.includes(p)) || null;
}

function linhasPermitidas(usuario) {
    return usuario.empresas.flatMap(e => EMPRESAS[e].linhas);
}

// Procura, num texto livre ("723, 721"), prefixos de empresas que o usuário não pode acessar.
function prefixosProibidos(texto, usuario) {
    const itens = String(texto || '').split(/[\s,;\/\-]+/).filter(Boolean);
    return itens.filter(item => {
        const emp = empresaDoPrefixo(item);
        return emp && !usuario.empresas.includes(emp);
    });
}

// Valida a ocorrência e descobre a empresa dela. Retorna { empresa } ou { erro }.
function validarOcorrencia(dados, usuario, empresaAtual) {
    const tipo = dados.tipo;

    const camposLivres = [dados.prefixo, dados.mecSubstPrefixo, dados.colSubstPrefixo, dados.desvCarros];
    for (const texto of camposLivres) {
        const proibidos = prefixosProibidos(texto, usuario);
        if (proibidos.length > 0) return { erro: `Prefixo ${proibidos[0]} não existe na frota.` };
    }

    if (tipo === 'Desvio' || tipo === 'Atraso') {
        const escolhida = usuario.empresas.length === 1 ? usuario.empresas[0] : String(dados.empresa || '');
        if (escolhida && !usuario.empresas.includes(escolhida)) return { erro: 'Empresa inválida.' };

        if (tipo === 'Atraso') {
            if (!escolhida) return { erro: 'Informe a empresa.' };
            if (dados.linha && !EMPRESAS[escolhida].linhas.includes(dados.linha)) {
                return { erro: `A linha ${dados.linha} não pertence a essa empresa.` };
            }
            return { empresa: escolhida };
        }

        const permitidas = linhasPermitidas(usuario);
        const invalida = String(dados.linha || '').split(',').map(l => l.trim()).filter(Boolean)
            .find(l => !permitidas.includes(l));
        if (invalida) return { erro: `A linha ${invalida} não existe.` };
        return { empresa: escolhida || empresaAtual || 'Operacional' };
    }

    const emp = empresaDoPrefixo(dados.prefixo);
    if (!emp) {
        if (empresaAtual && empresaAtual !== 'Operacional') return { empresa: empresaAtual };
        return { erro: `Prefixo ${dados.prefixo} não existe na frota.` };
    }
    if (!usuario.empresas.includes(emp)) return { erro: `Prefixo ${dados.prefixo} não existe na frota.` };
    if (dados.linha && !EMPRESAS[emp].linhas.includes(dados.linha)) {
        return { erro: `O carro ${dados.prefixo} não roda na linha ${dados.linha}.` };
    }
    return { empresa: emp };
}
// ===== FIM DAS REGRAS DE ACESSO =====

function sanitizar(corpo) {
    const saida = {};
    for (const key in (corpo || {})) {
        saida[key] = typeof corpo[key] === 'string' ? xss(corpo[key]) : corpo[key];
    }
    return saida;
}

function lerDados(texto) {
    try { return JSON.parse(texto || '{}'); } catch (e) { return {}; }
}

function formatarOcorrencia(r) {
    return { ...lerDados(r.dados), id: r.id, protocolo: r.protocolo, empresa: r.empresa, dataCriacao: r.data_criacao };
}

// Evita que um erro inesperado derrube o servidor.
const rota = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(err => {
        console.error('Erro na rota', req.method, req.path, '-', err.message);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    });
};

// Confere o token E consulta o usuário no banco: permissão alterada ou login desativado valem na hora.
const auth = rota(async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ error: 'Acesso Negado. Token ausente.' });

    let decoded;
    try {
        decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    } catch (e) {
        return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    }

    const { data: user, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq(decoded.id ? 'id' : 'login', decoded.id || decoded.login)
        .maybeSingle();

    if (error || !user || user.ativo === false) {
        return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    }

    req.usuarioLogado = {
        id: user.id,
        login: user.login,
        nome: user.nome,
        role: user.role,
        empresas: empresasDoUsuario(user),
        precisaTrocarSenha: user.precisa_trocar_senha === true
    };
    next();
});

function somenteAdmin(req, res, next) {
    if (req.usuarioLogado.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
    }
    next();
}

// ===== LOGIN E SENHA =====
app.post('/api/login', rota(async (req, res) => {
    const login = String(req.body.login || req.body.usuario || '').trim();
    const senha = String(req.body.senha || req.body.password || '');

    if (!login || !senha) return res.status(400).json({ error: 'Informe usuário e senha.' });

    const { data: user, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('login', login)
        .maybeSingle();

    if (error) {
        console.error('Erro no login (Supabase):', error.message);
        return res.status(500).json({ error: 'Erro ao consultar o banco de dados.' });
    }

    const senhaOk = user && typeof user.senha_hash === 'string' && bcrypt.compareSync(senha, user.senha_hash);
    if (!user || user.ativo === false || !senhaOk) {
        return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }

    const token = jwt.sign(
        { id: user.id, login: user.login, role: user.role, nome: user.nome, empresas: empresasDoUsuario(user) },
        JWT_SECRET,
        { expiresIn: '8h' }
    );
    res.json({
        sucesso: true,
        nome: user.nome,
        role: user.role,
        token: token,
        precisaTrocarSenha: user.precisa_trocar_senha === true
    });
}));

app.post('/api/minha-senha', auth, rota(async (req, res) => {
    const senhaAtual = String(req.body.senhaAtual || '');
    const senhaNova = String(req.body.senhaNova || '');

    if (senhaNova.length < 6) return res.status(400).json({ error: 'A nova senha precisa ter pelo menos 6 caracteres.' });
    if (senhaNova === senhaAtual) return res.status(400).json({ error: 'A nova senha precisa ser diferente da atual.' });

    const { data: user } = await supabase.from('usuarios').select('*').eq('id', req.usuarioLogado.id).maybeSingle();
    if (!user || !bcrypt.compareSync(senhaAtual, user.senha_hash)) {
        return res.status(400).json({ error: 'A senha atual está incorreta.' });
    }

    const { error } = await supabase
        .from('usuarios')
        .update({ senha_hash: bcrypt.hashSync(senhaNova, 10), precisa_trocar_senha: false })
        .eq('id', user.id);

    if (error) return res.status(500).json({ error: 'Erro ao salvar a nova senha.' });
    res.json({ sucesso: true });
}));

// ===== FROTA E LINHAS (já filtradas por quem está logado) =====
app.get('/api/frota', auth, (req, res) => {
    const empresas = req.usuarioLogado.empresas.map(chave => ({
        chave,
        nome: EMPRESAS[chave].nome,
        prefixos: EMPRESAS[chave].prefixos,
        linhas: EMPRESAS[chave].linhas
    }));
    res.json({ empresas, empresaUnica: empresas.length === 1 ? empresas[0].chave : null });
});

// ===== GESTÃO DE USUÁRIOS (somente admin) =====
const ROLES = ['admin', 'operador'];
const idValido = id => /^[0-9a-f-]{36}$/i.test(String(id));

function normalizarEmpresas(lista) {
    const validas = Array.isArray(lista) ? lista.filter(e => TODAS_EMPRESAS.includes(e)) : [];
    if (!validas.includes('CDA')) validas.push('CDA');
    return [...new Set(validas)];
}

function usuarioSeguro(u) {
    return {
        id: u.id,
        login: u.login,
        nome: u.nome,
        role: u.role,
        empresas: Array.isArray(u.empresas_permitidas) ? u.empresas_permitidas : [],
        ativo: u.ativo !== false,
        precisaTrocarSenha: u.precisa_trocar_senha === true
    };
}

async function ehUltimoAdminAtivo(idAlvo) {
    const { data } = await supabase.from('usuarios').select('id, ativo').eq('role', 'admin').neq('id', idAlvo);
    return !(data || []).some(u => u.ativo !== false);
}

app.get('/api/usuarios', auth, somenteAdmin, rota(async (req, res) => {
    const { data, error } = await supabase.from('usuarios').select('*').order('nome', { ascending: true });
    if (error) return res.status(500).json({ error: 'Erro ao listar usuários: ' + error.message });
    res.json(data.map(usuarioSeguro));
}));

app.post('/api/usuarios', auth, somenteAdmin, rota(async (req, res) => {
    const login = String(req.body.login || '').trim();
    const senha = String(req.body.senha || '');
    const nome = String(req.body.nome || '').trim();
    const role = ROLES.includes(req.body.role) ? req.body.role : 'operador';

    if (!login || !senha || !nome) return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
    if (!/^[A-Za-z0-9._@-]{3,40}$/.test(login)) {
        return res.status(400).json({ error: 'O login deve ter de 3 a 40 caracteres, sem espaços (letras, números, ponto, traço ou _).' });
    }
    if (senha.length < 6) return res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres.' });

    const { data: existente } = await supabase.from('usuarios').select('id').eq('login', login).maybeSingle();
    if (existente) return res.status(409).json({ error: 'Já existe um usuário com esse login.' });

    const { error } = await supabase.from('usuarios').insert([{
        id: uuidv4(),
        login,
        senha_hash: bcrypt.hashSync(senha, 10),
        nome: xss(nome),
        role,
        empresas_permitidas: normalizarEmpresas(req.body.empresasPermitidas),
        ativo: true,
        precisa_trocar_senha: true
    }]);

    if (error) return res.status(500).json({ error: 'Erro ao criar usuário: ' + error.message });
    res.status(201).json({ sucesso: true, mensagem: 'Usuário criado com sucesso!' });
}));

app.put('/api/usuarios/:id', auth, somenteAdmin, rota(async (req, res) => {
    const id = req.params.id;
    if (!idValido(id)) return res.status(400).json({ error: 'Identificador inválido.' });

    const { data: alvo } = await supabase.from('usuarios').select('*').eq('id', id).maybeSingle();
    if (!alvo) return res.status(404).json({ error: 'Usuário não encontrado.' });

    const atualizacao = {};
    if (req.body.nome !== undefined) {
        const nome = String(req.body.nome).trim();
        if (!nome) return res.status(400).json({ error: 'O nome não pode ficar vazio.' });
        atualizacao.nome = xss(nome);
    }
    if (req.body.role !== undefined) {
        if (!ROLES.includes(req.body.role)) return res.status(400).json({ error: 'Perfil inválido.' });
        atualizacao.role = req.body.role;
    }
    if (req.body.empresasPermitidas !== undefined) {
        atualizacao.empresas_permitidas = normalizarEmpresas(req.body.empresasPermitidas);
    }
    if (req.body.ativo !== undefined) atualizacao.ativo = req.body.ativo === true;

    const perdeAdmin = alvo.role === 'admin' && alvo.ativo !== false &&
        ((atualizacao.role && atualizacao.role !== 'admin') || atualizacao.ativo === false);
    if (perdeAdmin) {
        if (alvo.id === req.usuarioLogado.id) {
            return res.status(400).json({ error: 'Você não pode remover o seu próprio acesso de administrador.' });
        }
        if (await ehUltimoAdminAtivo(alvo.id)) {
            return res.status(400).json({ error: 'Este é o último administrador ativo. Crie outro antes de alterá-lo.' });
        }
    }

    if (Object.keys(atualizacao).length === 0) return res.status(400).json({ error: 'Nada para atualizar.' });

    const { error } = await supabase.from('usuarios').update(atualizacao).eq('id', id);
    if (error) return res.status(500).json({ error: 'Erro ao atualizar usuário: ' + error.message });
    res.json({ sucesso: true });
}));

app.post('/api/usuarios/:id/resetar-senha', auth, somenteAdmin, rota(async (req, res) => {
    const id = req.params.id;
    const senhaNova = String(req.body.senhaNova || '');
    if (!idValido(id)) return res.status(400).json({ error: 'Identificador inválido.' });
    if (senhaNova.length < 6) return res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres.' });

    const { data, error } = await supabase
        .from('usuarios')
        .update({ senha_hash: bcrypt.hashSync(senhaNova, 10), precisa_trocar_senha: true })
        .eq('id', id)
        .select('id');

    if (error) return res.status(500).json({ error: 'Erro ao resetar a senha: ' + error.message });
    if (!data || data.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
    res.json({ sucesso: true });
}));

app.delete('/api/usuarios/:id', auth, somenteAdmin, rota(async (req, res) => {
    const id = req.params.id;
    if (!idValido(id)) return res.status(400).json({ error: 'Identificador inválido.' });

    const { data: alvo } = await supabase.from('usuarios').select('*').eq('id', id).maybeSingle();
    if (!alvo) return res.status(404).json({ error: 'Usuário não encontrado.' });

    if (alvo.id === req.usuarioLogado.id) {
        return res.status(400).json({ error: 'Você não pode excluir o seu próprio login.' });
    }
    if (alvo.role === 'admin' && alvo.ativo !== false && await ehUltimoAdminAtivo(alvo.id)) {
        return res.status(400).json({ error: 'Este é o último administrador ativo. Crie outro antes de excluí-lo.' });
    }

    const { error } = await supabase.from('usuarios').delete().eq('id', id);
    if (error) return res.status(500).json({ error: 'Erro ao excluir usuário: ' + error.message });
    res.json({ sucesso: true });
}));

// ===== OCORRÊNCIAS =====
app.get('/api/ocorrencias', auth, rota(async (req, res) => {
    const { data, error } = await supabase
        .from('ocorrencias')
        .select('*')
        .order('data_criacao', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const visiveis = data.filter(r => podeVerEmpresa(req.usuarioLogado, r.empresa));
    res.json(visiveis.map(formatarOcorrencia));
}));

app.post('/api/ocorrencias', auth, rota(async (req, res) => {
    const dados = sanitizar(req.body);

    const validacao = validarOcorrencia(dados, req.usuarioLogado, null);
    if (validacao.erro) return res.status(400).json({ error: validacao.erro });

    const empresaDetectada = validacao.empresa;
    dados.empresa = empresaDetectada;
    dados.criadoPor = req.usuarioLogado.nome;
    dados.historico = [];

    const anoAtual = new Date().getFullYear();

    const { count, error: countError } = await supabase
        .from('ocorrencias')
        .select('*', { count: 'exact', head: true });

    if (countError) return res.status(500).json({ error: 'Erro no count: ' + countError.message });

    const total = count || 0;
    const numeroSequencial = (total + 1).toString().padStart(5, '0');
    const protocolo = `${numeroSequencial}/${anoAtual}`;
    const id = uuidv4();
    const dataCriacao = new Date().toISOString();

    const { error: insertError } = await supabase
        .from('ocorrencias')
        .insert([{
            id,
            protocolo,
            empresa: empresaDetectada,
            tipo: dados.tipo,
            data_criacao: dataCriacao,
            dados: JSON.stringify(dados)
        }]);

    if (insertError) return res.status(500).json({ error: 'Erro no insert: ' + insertError.message });

    res.status(201).json({ ...dados, id, protocolo, empresa: empresaDetectada, dataCriacao });
}));

app.put('/api/ocorrencias/:id', auth, rota(async (req, res) => {
    const id = req.params.id;
    const dadosNovos = sanitizar(req.body);

    const { data: row, error: fetchError } = await supabase
        .from('ocorrencias')
        .select('*')
        .eq('id', id)
        .single();

    if (fetchError || !row || !podeVerEmpresa(req.usuarioLogado, row.empresa)) {
        return res.status(404).json({ error: 'Ocorrência não encontrada.' });
    }

    dadosNovos.tipo = row.tipo;

    const validacao = validarOcorrencia(dadosNovos, req.usuarioLogado, row.empresa);
    if (validacao.erro) return res.status(400).json({ error: validacao.erro });

    const dadosAntigos = lerDados(row.dados);
    const historico = dadosAntigos.historico || [];
    const alteracoes = [];

    for (const key in dadosNovos) {
        if (!['historico', 'criadoPor', 'status', 'empresa'].includes(key)) {
            if (dadosNovos[key] !== dadosAntigos[key]) {
                alteracoes.push({
                    campo: key,
                    de: dadosAntigos[key] || '(Vazio)',
                    para: dadosNovos[key] || '(Vazio)'
                });
            }
        }
    }

    if (validacao.empresa !== row.empresa) {
        alteracoes.push({ campo: 'empresa', de: row.empresa || '(Vazio)', para: validacao.empresa });
    }

    if (alteracoes.length > 0 || dadosNovos.status !== dadosAntigos.status) {
        historico.push({
            dataHora: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
            usuario: req.usuarioLogado.nome,
            novoStatus: dadosNovos.status,
            mudancas: alteracoes
        });
    }

    dadosNovos.empresa = validacao.empresa;
    dadosNovos.historico = historico;
    dadosNovos.criadoPor = dadosAntigos.criadoPor;

    const { error: updateError } = await supabase
        .from('ocorrencias')
        .update({
            empresa: validacao.empresa,
            tipo: dadosNovos.tipo,
            dados: JSON.stringify(dadosNovos)
        })
        .eq('id', id);

    if (updateError) return res.status(500).json({ error: 'Erro ao atualizar.' });
    res.json({ sucesso: true, id: id });
}));

app.delete('/api/ocorrencias/:id', auth, somenteAdmin, rota(async (req, res) => {
    const { data, error } = await supabase
        .from('ocorrencias')
        .delete()
        .eq('id', req.params.id)
        .select();

    if (error) return res.status(500).json({ error: 'Erro ao excluir.' });
    if (!data || data.length === 0) return res.status(404).json({ error: 'Ocorrência não encontrada.' });

    res.json({ mensagem: 'Excluída com sucesso.' });
}));

app.get('/api/exportar', auth, rota(async (req, res) => {
    const { data, error } = await supabase
        .from('ocorrencias')
        .select('*')
        .order('data_criacao', { ascending: false });

    const rows = (data || []).filter(r => podeVerEmpresa(req.usuarioLogado, r.empresa));
    if (error || rows.length === 0) return res.status(400).send('Sem dados para exportar');

    let csv = 'Protocolo;Tipo;Carro;Linha;Inicio;Defeito_Motivo;Local;Providencia;Status\n';

    rows.forEach(r => {
        const oc = lerDados(r.dados);
        const inicio = oc.mecHoraInicio || oc.desvHoraInicio || oc.colHoraInicio || oc.atrHoraInicio || '-';
        const defeito = oc.mecDefeito || oc.desvMotivo || oc.atrMotivo || '-';
        const local = oc.mecLocal || oc.desvLocal || oc.colLocal || oc.atrLocal || '-';
        const prov = oc.mecProvidencia || oc.desvRota || oc.colProvidencia || '-';

        csv += `${r.protocolo};${oc.tipo};${oc.prefixo || '-'};${oc.linha || '-'};${inicio};${defeito};${local};${prov};${oc.status || 'Pendente'}\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="relatorio_sico_v2.csv"');
    res.send(csv);
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`SICO 2.2 Rodando na porta ${PORT} conectado ao Supabase com controle de acesso por empresa e gestão de usuários!`);
});
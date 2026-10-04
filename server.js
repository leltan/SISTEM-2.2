require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const xss = require('xss');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

const JWT_SECRET = 'sico-chave-secreta-2026-v1';

const usuariosRaw = [
    { login: 'marcos.admin', senha: '123', nome: 'Marcos Gestor', role: 'admin' },
    { login: 'felipe.op',    senha: '123', nome: 'Felipe Operador', role: 'operador' }
];

const usuarios = usuariosRaw.map(u => ({
    ...u,
    senha: bcrypt.hashSync(u.senha, 10)
}));

const frotaFervima = ['677', '678', '679', '680', '681', '682', '683', '684', '686', '687', '688', '689', '690', '691', '692', '693', '694', '695', '697', '698', '699', '700', '701', '702', '703', '704', '705', '706', '707', '708', '709', '710', '711', '712', '714', '715', '716', '717', '718', '719', '720', '721', '722', '723', '724', '725', '726', '727', '728', '729', '730', '731', '732', '733'];
const frotaPirajucara = ['868', '869', '870', '871', '872', '873', '875', '877', '879', '880', '881', '882', '883', '884', '885', '886', '887', '888', '889', '890', '891', '892', '893', '894', '895', '896', '897', '898', '899', '900', '901', '902', '903', '904', '906', '907', '908', '910', '911', '912', '913'];
const linhasFervima = ['Circular 02', 'Circular 03', 'Circular 04', 'Circular 07.1', 'Circular 07.2', 'Circular 08'];
const linhasPirajucara = ['Circular 05', 'Circular 06', 'Circular 09', 'Circular 09.1'];

function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ error: "Acesso Negado. Token ausente." });

    const token = authHeader.split(' ')[1];
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: "Sessão inválida ou expirada." });
        req.usuarioLogado = decoded;
        next();
    });
}

app.post('/api/login', (req, res) => {
    const { login, senha } = req.body;
    const user = usuarios.find(u => u.login === login);
    
    if (user && bcrypt.compareSync(senha, user.senha)) {
        const token = jwt.sign(
            { login: user.login, role: user.role, nome: user.nome },
            JWT_SECRET,
            { expiresIn: '8h' }
        );
        res.json({ sucesso: true, nome: user.nome, role: user.role, token: token });
    } else {
        res.status(401).json({ error: "Usuário ou senha inválidos" });
    }
});

app.get('/api/ocorrencias', verificarToken, async (req, res) => {
    const { data, error } = await supabase
        .from('ocorrencias')
        .select('*')
        .order('data_criacao', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const ocorrenciasFormatadas = data.map(r => ({
        id: r.id,
        protocolo: r.protocolo,
        empresa: r.empresa,
        dataCriacao: r.data_criacao,
        ...JSON.parse(r.dados || '{}')
    }));

    res.json(ocorrenciasFormatadas);
});

app.post('/api/ocorrencias', verificarToken, async (req, res) => {
    const dadosRaw = req.body;
    const dados = {};
    
    for (const key in dadosRaw) {
        if (typeof dadosRaw[key] === 'string') {
            dados[key] = xss(dadosRaw[key]);
        } else {
            dados[key] = dadosRaw[key];
        }
    }

    dados.criadoPor = req.usuarioLogado.nome;
    dados.historico = [];

    let empresaDetectada = '';

    if (dados.tipo !== 'Desvio' && dados.tipo !== 'Atraso') {
        if (frotaFervima.includes(dados.prefixo)) empresaDetectada = 'Fervima';
        else if (frotaPirajucara.includes(dados.prefixo)) empresaDetectada = 'Pirajuçara';
        else return res.status(400).json({ error: `Prefixo ${dados.prefixo} não existe na frota.` });

        if (dados.linha) {
            if (empresaDetectada === 'Fervima' && !linhasFervima.includes(dados.linha)) {
                return res.status(400).json({ error: `O carro ${dados.prefixo} não roda na linha ${dados.linha}.` });
            }
            if (empresaDetectada === 'Pirajuçara' && !linhasPirajucara.includes(dados.linha)) {
                return res.status(400).json({ error: `O carro ${dados.prefixo} não roda na linha ${dados.linha}.` });
            }
        }
    } else if (dados.tipo === 'Atraso') {
        empresaDetectada = dados.empresa;
    } else {
        empresaDetectada = 'Operacional'; 
    }

    const anoAtual = new Date().getFullYear();
    
    const { count, error: countError } = await supabase
        .from('ocorrencias')
        .select('*', { count: 'exact', head: true });

    if (countError) return res.status(500).json({ error: "Erro interno no banco." });

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

    if (insertError) return res.status(500).json({ error: "Erro ao gravar B.O." });

    res.status(201).json({
        id, protocolo, empresa: empresaDetectada, dataCriacao, ...dados
    });
});

app.put('/api/ocorrencias/:id', verificarToken, async (req, res) => {
    const id = req.params.id;
    const dadosNovosRaw = req.body;
    const dadosNovos = {};
    
    for (const key in dadosNovosRaw) {
        if (typeof dadosNovosRaw[key] === 'string') {
            dadosNovos[key] = xss(dadosNovosRaw[key]);
        } else {
            dadosNovos[key] = dadosNovosRaw[key];
        }
    }

    const { data: row, error: fetchError } = await supabase
        .from('ocorrencias')
        .select('*')
        .eq('id', id)
        .single();

    if (fetchError || !row) return res.status(404).json({ error: "Ocorrência não encontrada." });

    const dadosAntigos = JSON.parse(row.dados || '{}');
    const historico = dadosAntigos.historico || [];
    const alteracoes = [];

    for(const key in dadosNovos) {
        if (key !== 'historico' && key !== 'criadoPor' && key !== 'status') {
            if (dadosNovos[key] !== dadosAntigos[key]) {
                alteracoes.push({
                    campo: key,
                    de: dadosAntigos[key] || '(Vazio)',
                    para: dadosNovos[key] || '(Vazio)'
                });
            }
        }
    }

    if (alteracoes.length > 0 || dadosNovos.status !== dadosAntigos.status) {
        historico.push({
            dataHora: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
            usuario: req.usuarioLogado.nome,
            novoStatus: dadosNovos.status,
            mudancas: alteracoes
        });
    }

    dadosNovos.historico = historico;
    dadosNovos.criadoPor = dadosAntigos.criadoPor; 

    let empresaDetectada = row.empresa;
    if (dadosNovos.tipo !== 'Desvio' && dadosNovos.tipo !== 'Atraso') {
        if (frotaFervima.includes(dadosNovos.prefixo)) empresaDetectada = 'Fervima';
        else if (frotaPirajucara.includes(dadosNovos.prefixo)) empresaDetectada = 'Pirajuçara';
    } else if (dadosNovos.tipo === 'Atraso') {
        empresaDetectada = dadosNovos.empresa;
    }

    const { error: updateError } = await supabase
        .from('ocorrencias')
        .update({
            empresa: empresaDetectada,
            tipo: dadosNovos.tipo,
            dados: JSON.stringify(dadosNovos)
        })
        .eq('id', id);

    if (updateError) return res.status(500).json({ error: "Erro ao atualizar." });
    res.json({ sucesso: true, id: id });
});

app.delete('/api/ocorrencias/:id', verificarToken, async (req, res) => {
    const roleUsuario = req.usuarioLogado.role;
    const idParaApagar = req.params.id;

    if (roleUsuario !== 'admin') return res.status(403).json({ error: "Acesso Negado." });

    const { data, error } = await supabase
        .from('ocorrencias')
        .delete()
        .eq('id', idParaApagar)
        .select();

    if (error) return res.status(500).json({ error: "Erro ao excluir." });
    if (!data || data.length === 0) return res.status(404).json({ error: "Ocorrência não encontrada." });

    res.json({ mensagem: "Excluída com sucesso." });
});

app.get('/api/exportar', verificarToken, async (req, res) => {
    const { data: rows, error } = await supabase
        .from('ocorrencias')
        .select('*')
        .order('data_criacao', { ascending: false });

    if (error || !rows || rows.length === 0) return res.status(400).send("Sem dados para exportar");

    let csv = "Protocolo;Tipo;Carro;Linha;Inicio;Defeito_Motivo;Local;Providencia;Status\n";

    rows.forEach(r => {
        const oc = JSON.parse(r.dados || '{}');
        let inicio = oc.mecHoraInicio || oc.desvHoraInicio || oc.colHoraInicio || oc.atrHoraInicio || '-';
        let defeito = oc.mecDefeito || oc.desvMotivo || oc.atrMotivo || '-';
        let local = oc.mecLocal || oc.desvLocal || oc.colLocal || oc.atrLocal || '-';
        let prov = oc.mecProvidencia || oc.desvRota || oc.colProvidencia || '-';

        csv += `${r.protocolo};${oc.tipo};${oc.prefixo || '-'};${oc.linha || '-'};${inicio};${defeito};${local};${prov};${oc.status || 'Pendente'}\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=\"relatorio_sico_v2.csv\"');
    res.send(csv);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`SICO 2.2 Rodando na porta ${PORT} conectado ao Supabase!`);
});
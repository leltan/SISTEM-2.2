const API_URL = '/api';

let usuarioAtual = null;
let listaOcorrencias = [];
let listaUsuarios = [];

// Frota e linhas liberadas para quem está logado. Vem do servidor (/api/frota).
let frotaUsuario = { empresas: [], empresaUnica: null };

const ESTILO_EMPRESA = {
    'Fervima': { nome: 'FERVIMA', curto: 'Fervima', badge: 'badge-fervima', linha: 'linha-fervima' },
    'Pirajuçara': { nome: 'PIRAJUÇARA', curto: 'Pirajuçara', badge: 'badge-pirajucara', linha: 'linha-pirajucara' },
    'CDA': { nome: 'CIDADE DAS ARTES', curto: 'Cidade das Artes', badge: 'badge-cda', linha: 'linha-cda' }
};

function esc(texto) {
    return String(texto === null || texto === undefined ? '' : texto)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function addOption(pai, valor, texto) {
    const opt = document.createElement('option');
    opt.value = valor;
    opt.textContent = texto;
    pai.appendChild(opt);
    return opt;
}

function cabecalhoAuth(comJson) {
    const h = { 'Authorization': `Bearer ${localStorage.getItem('sico_token')}` };
    if (comJson) h['Content-Type'] = 'application/json';
    return h;
}

function lerPayload(token) {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
}

function empresaDoPrefixo(prefixo) {
    const emp = frotaUsuario.empresas.find(e => e.prefixos.includes(prefixo));
    return emp ? emp.chave : null;
}

async function carregarFrota() {
    try {
        const response = await fetch(`${API_URL}/frota`, { headers: cabecalhoAuth() });
        if (response.status === 401 || response.status === 403) { logout(); return false; }
        if (!response.ok) throw new Error('frota');
        frotaUsuario = await response.json();
        preencherListasFrota();
        return true;
    } catch (e) {
        alert('Não foi possível carregar os dados do sistema. Atualize a página e tente novamente.');
        return false;
    }
}

// Monta os campos do formulário só com o que o usuário pode usar.
function preencherListasFrota() {
    const unica = frotaUsuario.empresaUnica;
    const empresas = frotaUsuario.empresas;

    document.getElementById('subtitulo-empresas').innerText = empresas.map(e => e.nome).join(' · ');

    // Logos no menu lateral: só das empresas que o usuário pode ver
    const caixaLogos = document.getElementById('logos-empresas');
    caixaLogos.innerHTML = '';
    [
        { chave: 'Pirajuçara', src: 'img/logo-piraju.png', alt: 'Viação Pirajuçara', estilo: 'height:42px;width:42px;background:#ececf3;border-radius:50%;padding:3px;' },
        { chave: 'CDA', src: 'img/logo-cda.png', alt: 'Viação Cidade das Artes', estilo: 'height:42px;width:auto;border-radius:8px;' }
    ].forEach(l => {
        if (!empresas.some(e => e.chave === l.chave)) return;
        const img = document.createElement('img');
        img.src = l.src;
        img.alt = l.alt;
        img.title = l.alt;
        img.style.cssText = l.estilo + 'object-fit:contain;';
        caixaLogos.appendChild(img);
    });

    const selPrefixo = document.getElementById('prefixo');
    selPrefixo.innerHTML = '';
    addOption(selPrefixo, '', 'Selecione o prefixo...');
    empresas.forEach(emp => {
        let pai = selPrefixo;
        if (!unica) {
            pai = document.createElement('optgroup');
            pai.label = emp.nome;
            selPrefixo.appendChild(pai);
        }
        emp.prefixos.forEach(p => addOption(pai, p, p));
    });

    ['desv-empresa', 'atr-empresa'].forEach(id => {
        const sel = document.getElementById(id);
        sel.innerHTML = '';
        if (!unica) addOption(sel, '', 'Selecione...');
        empresas.forEach(emp => addOption(sel, emp.chave, (ESTILO_EMPRESA[emp.chave] || {}).curto || emp.nome));
    });

    document.getElementById('bloco-desv-empresa').classList.toggle('d-none', !!unica);
    document.getElementById('col-atr-empresa').classList.toggle('d-none', !!unica);

    gerarCheckboxesLinhas();
    verificarEmpresa();
    atualizarLinhasAtraso();
}

async function restaurarSessao() {
    const token = localStorage.getItem('sico_token');
    if (!token) return;

    try {
        const payload = lerPayload(token);
        if (payload.exp * 1000 < Date.now()) {
            logout();
            return;
        }
        usuarioAtual = { nome: payload.nome || payload.login, role: payload.role, login: payload.login };
        document.getElementById('login-screen').classList.add('d-none');
        document.getElementById('dashboard-screen').classList.remove('d-none');
        document.getElementById('user-display').innerText = `Olá, ${usuarioAtual.nome}`;
        document.getElementById('menu-usuarios').classList.toggle('d-none', usuarioAtual.role !== 'admin');

        const frotaOk = await carregarFrota();
        if (!frotaOk) return;
        carregarOcorrencias();
        if (localStorage.getItem('sico_trocar_senha') === '1') abrirTrocarSenha(true);
    } catch (e) {
        logout();
    }
}

document.getElementById('form-login').addEventListener('submit', async function(e) {
    e.preventDefault();
    const usuario = document.getElementById('login-usuario').value;
    const senha = document.getElementById('login-senha').value;
    
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: usuario, senha: senha })
        });
        const dados = await response.json();

        if (response.ok) {
            localStorage.setItem('sico_token', dados.token);
            if (dados.precisaTrocarSenha) localStorage.setItem('sico_trocar_senha', '1');
            else localStorage.removeItem('sico_trocar_senha');
            restaurarSessao();
        } else {
            const erroEl = document.getElementById('login-erro');
            erroEl.textContent = (response.status === 400 || response.status === 401)
                ? 'Usuário ou senha inválidos.'
                : 'Erro no servidor. Tente novamente em instantes.';
            erroEl.classList.remove('d-none');
        }
    } catch (error) { alert("Erro de conexão."); }
});

function logout() { 
    localStorage.removeItem('sico_token');
    localStorage.removeItem('sico_trocar_senha');
    location.reload(); 
}

function prepararNovaOcorrencia() {
    document.getElementById('form-ocorrencia').reset();
    document.getElementById('ocorrencia-id').value = "";
    document.getElementById('titulo-modal-ocorrencia').innerHTML = "<i class='bx bx-plus-circle'></i> Nova Ocorrência";
    document.getElementById('tipo').disabled = false;
    
    document.getElementById('container-vitimas').innerHTML = '';
    adicionarVitima(); 

    verificarEmpresa();
    atualizarLinhasAtraso();
    ajustarFormulario();
}

function gerarCheckboxesLinhas() {
    const container = document.getElementById('container-linhas-check');
    if (!container) return;
    container.innerHTML = '';
    frotaUsuario.empresas.forEach(emp => {
        if (!frotaUsuario.empresaUnica) {
            const titulo = document.createElement('div');
            titulo.className = 'col-12 fw-bold small text-muted mt-2';
            titulo.textContent = emp.nome;
            container.appendChild(titulo);
        }
        emp.linhas.forEach(linha => {
            const div = document.createElement('div');
            div.className = 'col-6 col-md-4';
            div.innerHTML = `
                <div class="form-check">
                    <input class="form-check-input linha-checkbox" type="checkbox" value="${esc(linha)}" id="chk-${linha.replace(/[\s\/.]/g, '')}">
                    <label class="form-check-label" for="chk-${linha.replace(/[\s\/.]/g, '')}">${esc(linha)}</label>
                </div>
            `;
            container.appendChild(div);
        });
    });
}

function verificarEmpresa() {
    const prefixo = document.getElementById('prefixo').value;
    const badge = document.getElementById('empresa-badge');
    const selectLinha = document.getElementById('linha');

    selectLinha.innerHTML = '';
    addOption(selectLinha, '', 'Selecione...');

    const chave = empresaDoPrefixo(prefixo);
    if (chave) {
        const estilo = ESTILO_EMPRESA[chave];
        const emp = frotaUsuario.empresas.find(e => e.chave === chave);
        badge.innerText = estilo.nome;
        badge.className = `badge ${estilo.badge} mt-1 w-100 shadow-sm`;
        selectLinha.disabled = false;
        emp.linhas.forEach(l => addOption(selectLinha, l, l));
    } else {
        badge.innerText = "---";
        badge.className = "badge bg-secondary mt-1 w-100";
        selectLinha.disabled = true;
        selectLinha.options[0].textContent = 'Selecione o prefixo...';
    }

    if (frotaUsuario.empresaUnica) badge.classList.add('d-none');
}

function atualizarLinhasAtraso() {
    const chave = document.getElementById('atr-empresa').value;
    const selectLinha = document.getElementById('atr-linha');
    const selectPrefixo = document.getElementById('atr-prefixo');

    selectLinha.innerHTML = '';
    addOption(selectLinha, '', 'Selecione a empresa...');
    selectLinha.disabled = true;

    selectPrefixo.innerHTML = '';
    addOption(selectPrefixo, '', 'Vários / não informar');

    const emp = frotaUsuario.empresas.find(e => e.chave === chave);
    if (emp) {
        selectLinha.disabled = false;
        selectLinha.options[0].textContent = 'Selecione...';
        emp.linhas.forEach(l => addOption(selectLinha, l, l));
        emp.prefixos.forEach(p => addOption(selectPrefixo, p, p));
    }
}

document.addEventListener('DOMContentLoaded', () => {

    const btnToggleSenha = document.getElementById('btn-toggle-senha');
    const inputSenha = document.getElementById('login-senha');
    if (btnToggleSenha && inputSenha) {
        btnToggleSenha.addEventListener('click', function() {
            if (inputSenha.type === 'password') {
                inputSenha.type = 'text';
                btnToggleSenha.classList.remove('bx-hide');
                btnToggleSenha.classList.add('bx-show');
                btnToggleSenha.classList.add('text-primary');
            } else {
                inputSenha.type = 'password';
                btnToggleSenha.classList.remove('bx-show');
                btnToggleSenha.classList.add('bx-hide');
                btnToggleSenha.classList.remove('text-primary');
            }
        });
    }
});

function ajustarFormulario() {
    const tipo = document.getElementById('tipo').value;
    
    const todosInputs = document.querySelectorAll('#form-ocorrencia input, #form-ocorrencia select, #form-ocorrencia textarea');
    todosInputs.forEach(input => {
        if(input.id !== 'tipo' && input.id !== 'ocorrencia-id') input.required = false; 
    });

    document.getElementById('bloco-padrao').classList.add('d-none');
    document.getElementById('form-mecanica').classList.add('d-none');
    document.getElementById('form-desvio').classList.add('d-none');
    document.getElementById('form-colisao').classList.add('d-none');
    document.getElementById('form-atraso').classList.add('d-none');
    document.getElementById('form-generico').classList.add('d-none');

    if (tipo === 'Mecânica') {
        document.getElementById('bloco-padrao').classList.remove('d-none');
        document.getElementById('form-mecanica').classList.remove('d-none');
        document.getElementById('prefixo').required = true;
        document.getElementById('mec-data-inicio').required = true;
        document.getElementById('mec-hora-inicio').required = true;
        document.getElementById('mec-municipio').required = true;
        document.getElementById('mec-local').required = true;
        document.getElementById('mec-defeito').required = true;
        document.getElementById('mec-providencia').required = true;
    } 
    else if (tipo === 'Desvio') {
        document.getElementById('form-desvio').classList.remove('d-none');
        document.getElementById('desv-empresa').required = true;
        document.getElementById('desv-data-inicio').required = true;
        document.getElementById('desv-hora-inicio').required = true;
        document.getElementById('desv-municipio').required = true;
        document.getElementById('desv-local').required = true;
        document.getElementById('desv-motivo').required = true;
        document.getElementById('desv-rota').required = true;
    }
    else if (tipo === 'Colisão') {
        document.getElementById('bloco-padrao').classList.remove('d-none');
        document.getElementById('form-colisao').classList.remove('d-none');
        document.getElementById('prefixo').required = true;
        document.getElementById('col-data-inicio').required = true;
        document.getElementById('col-hora-inicio').required = true;
        document.getElementById('col-municipio').required = true;
        document.getElementById('col-local').required = true;
        document.getElementById('col-condutor-nome').required = true;
        document.getElementById('col-condutor-matricula').required = true;
        document.getElementById('col-avaria-coletivo').required = true;
        document.getElementById('col-providencia').required = true;
    }
    else if (tipo === 'Atraso') {
        document.getElementById('form-atraso').classList.remove('d-none');
        document.getElementById('atr-data-inicio').required = true;
        document.getElementById('atr-hora-inicio').required = true;
        document.getElementById('atr-municipio').required = true;
        document.getElementById('atr-local').required = true;
        document.getElementById('atr-empresa').required = true;
        document.getElementById('atr-linha').required = true;
        document.getElementById('atr-minutos').required = true;
        document.getElementById('atr-sentido').required = true;
        document.getElementById('atr-motivo').required = true;
    }
    else {
        document.getElementById('bloco-padrao').classList.remove('d-none');
        document.getElementById('form-generico').classList.remove('d-none');
        document.getElementById('prefixo').required = true;
    }
}

function verificarProvidencia() {
    const providencia = document.getElementById('mec-providencia').value;
    const divReassumiu = document.getElementById('extra-reassumiu');
    const divSubstituido = document.getElementById('extra-substituido');

    divReassumiu.classList.add('d-none');
    divSubstituido.classList.add('d-none');
    
    document.getElementById('reassumiu-sentido').required = false;
    document.getElementById('reassumiu-horario').required = false;
    document.getElementById('subst-prefixo').required = false;
    document.getElementById('subst-sentido').required = false;
    document.getElementById('subst-horario').required = false;

    if (providencia === 'Reassumiu') {
        divReassumiu.classList.remove('d-none');
        document.getElementById('reassumiu-sentido').required = true;
        document.getElementById('reassumiu-horario').required = true;
    } else if (providencia === 'Substituido') {
        divSubstituido.classList.remove('d-none');
        document.getElementById('subst-prefixo').required = true;
        document.getElementById('subst-sentido').required = true;
        document.getElementById('subst-horario').required = true;
    }
}

function verificarProvidenciaColisao() {
    const providencia = document.getElementById('col-providencia').value;
    const divReassumiu = document.getElementById('col-extra-reassumiu');
    const divSubstituido = document.getElementById('col-extra-substituido');

    divReassumiu.classList.add('d-none');
    divSubstituido.classList.add('d-none');
    
    document.getElementById('col-reassumiu-sentido').required = false;
    document.getElementById('col-reassumiu-horario').required = false;
    document.getElementById('col-subst-prefixo').required = false;
    document.getElementById('col-subst-sentido').required = false;
    document.getElementById('col-subst-horario').required = false;

    if (providencia === 'Reassumiu') {
        divReassumiu.classList.remove('d-none');
        document.getElementById('col-reassumiu-sentido').required = true;
        document.getElementById('col-reassumiu-horario').required = true;
    } else if (providencia === 'Substituido') {
        divSubstituido.classList.remove('d-none');
        document.getElementById('col-subst-prefixo').required = true;
        document.getElementById('col-subst-sentido').required = true;
        document.getElementById('col-subst-horario').required = true;
    }
}

function toggleTerceiro() {
    const valor = document.getElementById('col-houve-terceiro').value;
    const bloco = document.getElementById('bloco-terceiro');
    if (valor === 'Sim') bloco.classList.remove('d-none');
    else bloco.classList.add('d-none');
}

function toggleVitima() {
    const valor = document.getElementById('col-houve-vitima').value;
    const bloco = document.getElementById('bloco-vitimas');
    if (valor === 'Sim') bloco.classList.remove('d-none');
    else bloco.classList.add('d-none');
}

function adicionarVitima(v = {}) {
    const container = document.getElementById('container-vitimas');
    const div = document.createElement('div');
    div.className = 'vitima-item bg-white p-2 rounded mb-2 border row g-2 mt-2';
    div.innerHTML = `
        <div class="col-md-6"><label class="fw-bold small">Nome</label><input type="text" class="form-control form-control-sm vit-nome" value="${v.nome || ''}"></div>
        <div class="col-md-3"><label class="fw-bold small">CPF/RG</label><input type="text" class="form-control form-control-sm vit-doc" value="${v.doc || ''}"></div>
        <div class="col-md-3"><label class="fw-bold small">Idade</label><input type="number" class="form-control form-control-sm vit-idade" value="${v.idade || ''}"></div>
        <div class="col-md-5"><label class="fw-bold small">Estado da Vítima</label><input type="text" class="form-control form-control-sm vit-estado" value="${v.estado || ''}"></div>
        <div class="col-md-6"><label class="fw-bold small">Socorrida Para</label><input type="text" class="form-control form-control-sm vit-socorro" value="${v.socorro || ''}"></div>
        <div class="col-md-1 d-flex align-items-end"><button type="button" class="btn btn-sm btn-outline-danger w-100" onclick="this.parentElement.parentElement.remove()"><i class='bx bx-x'></i></button></div>
    `;
    container.appendChild(div);
}

document.getElementById('form-ocorrencia').addEventListener('submit', async function(e) {
    e.preventDefault(); 
    const tipo = document.getElementById('tipo').value;
    const idOcorrencia = document.getElementById('ocorrencia-id').value;
    let payload = { tipo: tipo };

    if (tipo === 'Mecânica') {
        payload.prefixo = document.getElementById('prefixo').value;
        payload.linha = document.getElementById('linha').value;
        payload.mecDataInicio = document.getElementById('mec-data-inicio').value;
        payload.mecHoraInicio = document.getElementById('mec-hora-inicio').value;
        payload.mecDataFim = document.getElementById('mec-data-fim').value;
        payload.mecHoraFim = document.getElementById('mec-hora-fim').value;
        payload.mecMunicipio = document.getElementById('mec-municipio').value;
        payload.mecLocal = document.getElementById('mec-local').value;
        payload.mecDefeito = document.getElementById('mec-defeito').value;
        payload.mecPartidaInterrompida = document.getElementById('mec-partida-interrompida').value;
        payload.mecCanceladasIda = document.getElementById('mec-canceladas-ida').value;
        payload.mecCanceladasVolta = document.getElementById('mec-canceladas-volta').value;
        payload.mecProvidencia = document.getElementById('mec-providencia').value;
        
        if(payload.mecProvidencia === 'Reassumiu') {
            payload.mecReassumiuSentido = document.getElementById('reassumiu-sentido').value;
            payload.mecReassumiuHorario = document.getElementById('reassumiu-horario').value;
        }
        if(payload.mecProvidencia === 'Substituido') {
            payload.mecSubstPrefixo = document.getElementById('subst-prefixo').value;
            payload.mecSubstSentido = document.getElementById('subst-sentido').value;
            payload.mecSubstHorario = document.getElementById('subst-horario').value;
        }
        payload.status = (payload.mecHoraFim || payload.mecDataFim) ? "Finalizada" : "Pendente";
    } 
    else if (tipo === 'Desvio') {
        const linhasMarcadas = [];
        document.querySelectorAll('.linha-checkbox:checked').forEach(chk => linhasMarcadas.push(chk.value));
        
        payload.empresa = document.getElementById('desv-empresa').value;
        payload.prefixo = "VÁRIOS"; 
        payload.linha = linhasMarcadas.join(', '); 
        payload.desvCarros = document.getElementById('desv-carros').value;
        payload.desvDataInicio = document.getElementById('desv-data-inicio').value;
        payload.desvHoraInicio = document.getElementById('desv-hora-inicio').value;
        payload.desvDataFim = document.getElementById('desv-data-fim').value;
        payload.desvHoraFim = document.getElementById('desv-hora-fim').value;
        payload.desvMunicipio = document.getElementById('desv-municipio').value;
        payload.desvLocal = document.getElementById('desv-local').value;
        payload.desvSentido = document.getElementById('desv-sentido').value;
        payload.desvMotivo = document.getElementById('desv-motivo').value;
        payload.desvPontosSem = document.getElementById('desv-pontos-sem').value;
        payload.desvRota = document.getElementById('desv-rota').value;
        payload.desvObs = document.getElementById('desv-obs').value;
        payload.status = (payload.desvHoraFim || payload.desvDataFim) ? "Finalizada" : "Pendente";
    }
    else if (tipo === 'Colisão') {
        payload.prefixo = document.getElementById('prefixo').value;
        payload.linha = document.getElementById('linha').value;
        payload.colDataInicio = document.getElementById('col-data-inicio').value;
        payload.colHoraInicio = document.getElementById('col-hora-inicio').value;
        payload.colDataFim = document.getElementById('col-data-fim').value;
        payload.colHoraFim = document.getElementById('col-hora-fim').value;
        payload.colMunicipio = document.getElementById('col-municipio').value;
        payload.colLocal = document.getElementById('col-local').value;
        payload.colCondutorNome = document.getElementById('col-condutor-nome').value;
        payload.colCondutorMatricula = document.getElementById('col-condutor-matricula').value;
        payload.colAvariaColetivo = document.getElementById('col-avaria-coletivo').value;
        payload.colPartidaInterrompida = document.getElementById('col-partida-interrompida').value;
        payload.colCanceladasIda = document.getElementById('col-canceladas-ida').value;
        payload.colCanceladasVolta = document.getElementById('col-canceladas-volta').value;
        payload.colProvidencia = document.getElementById('col-providencia').value;

        if(payload.colProvidencia === 'Reassumiu') {
            payload.colReassumiuSentido = document.getElementById('col-reassumiu-sentido').value;
            payload.colReassumiuHorario = document.getElementById('col-reassumiu-horario').value;
        }
        if(payload.colProvidencia === 'Substituido') {
            payload.colSubstPrefixo = document.getElementById('col-subst-prefixo').value;
            payload.colSubstSentido = document.getElementById('col-subst-sentido').value;
            payload.colSubstHorario = document.getElementById('col-subst-horario').value;
        }

        payload.colHouveTerceiro = document.getElementById('col-houve-terceiro').value;
        if(payload.colHouveTerceiro === 'Sim') {
            payload.colTercModelo = document.getElementById('col-terc-modelo').value;
            payload.colTercCor = document.getElementById('col-terc-cor').value;
            payload.colTercPlaca = document.getElementById('col-terc-placa').value;
            payload.colTercNome = document.getElementById('col-terc-nome').value;
            payload.colTercDoc = document.getElementById('col-terc-doc').value;
            payload.colTercTel = document.getElementById('col-terc-tel').value;
            payload.colTercEnd = document.getElementById('col-terc-end').value;
        }

        payload.colHouveVitima = document.getElementById('col-houve-vitima').value;
        if(payload.colHouveVitima === 'Sim') {
            const vitimas = [];
            document.querySelectorAll('.vitima-item').forEach(v => {
                vitimas.push({
                    nome: v.querySelector('.vit-nome').value,
                    doc: v.querySelector('.vit-doc').value,
                    idade: v.querySelector('.vit-idade').value,
                    estado: v.querySelector('.vit-estado').value,
                    socorro: v.querySelector('.vit-socorro').value
                });
            });
            payload.colVitimas = JSON.stringify(vitimas);
        }

        payload.colGcm = document.getElementById('col-gcm').value;
        payload.colPm = document.getElementById('col-pm').value;
        payload.colSamu = document.getElementById('col-samu').value;
        payload.colBo = document.getElementById('col-bo').value;
        payload.status = (payload.colHoraFim || payload.colDataFim) ? "Finalizada" : "Pendente";
    }
    else if (tipo === 'Atraso') {
        payload.empresa = document.getElementById('atr-empresa').value;
        payload.linha = document.getElementById('atr-linha').value;
        payload.prefixo = document.getElementById('atr-prefixo').value || 'VÁRIOS';
        payload.atrDataInicio = document.getElementById('atr-data-inicio').value;
        payload.atrHoraInicio = document.getElementById('atr-hora-inicio').value;
        payload.atrDataFim = document.getElementById('atr-data-fim').value;
        payload.atrHoraFim = document.getElementById('atr-hora-fim').value;
        payload.atrMunicipio = document.getElementById('atr-municipio').value;
        payload.atrLocal = document.getElementById('atr-local').value;
        payload.atrMinutos = document.getElementById('atr-minutos').value;
        payload.atrSentido = document.getElementById('atr-sentido').value;
        payload.atrMotivo = document.getElementById('atr-motivo').value;
        payload.atrObs = document.getElementById('atr-obs').value;
        payload.status = (payload.atrHoraFim || payload.atrDataFim) ? "Finalizada" : "Pendente";
    }

    try {
        const token = localStorage.getItem('sico_token');
        const url = idOcorrencia ? `${API_URL}/ocorrencias/${idOcorrencia}` : `${API_URL}/ocorrencias`;
        const method = idOcorrencia ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            bootstrap.Modal.getInstance(document.getElementById('modalOcorrencia')).hide();
            document.getElementById('form-ocorrencia').reset();
            alert(idOcorrencia ? "✅ Atualizado com sucesso!" : "✅ Salvo com sucesso!");
            carregarOcorrencias();
        } else {
            const erro = await response.json();
            alert("❌ Erro ao salvar: " + JSON.stringify(erro));
        }
    } catch (error) { 
        alert("Erro servidor. Verifique o console."); 
    }
});

function editarOcorrencia(id) {
    const item = listaOcorrencias.find(i => i.id === id);
    if (!item) return;

    prepararNovaOcorrencia(); 
    
    document.getElementById('titulo-modal-ocorrencia').innerHTML = `<i class='bx bx-edit'></i> Editar Ocorrência (${item.protocolo})`;
    document.getElementById('ocorrencia-id').value = item.id;
    
    const tipoSelect = document.getElementById('tipo');
    let tipoExiste = Array.from(tipoSelect.options).some(opt => opt.value === item.tipo);
    if(tipoExiste) {
        tipoSelect.value = item.tipo;
    } else {
        tipoSelect.value = "";
    }
    tipoSelect.disabled = true;

    ajustarFormulario();

    for (const key in item) {
        if (['colVitimas', 'linha', 'historico', 'status', 'criadoPor', 'dataCriacao', 'empresa'].includes(key)) continue; 
        const inputId = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        const input = document.getElementById(inputId);
        if (input && input.type !== 'checkbox' && input.type !== 'radio') {
            input.value = item[key] !== null && item[key] !== undefined ? item[key] : '';
        }
    }

    if (item.tipo === 'Mecânica' || item.tipo === 'Colisão') {
        if (item.prefixo && item.prefixo !== 'VÁRIOS') {
            document.getElementById('prefixo').value = item.prefixo;
            verificarEmpresa();
            setTimeout(() => { document.getElementById('linha').value = item.linha || ''; }, 100);
        }
        if (item.tipo === 'Mecânica') verificarProvidencia();
        if (item.tipo === 'Colisão') {
            verificarProvidenciaColisao();
            document.getElementById('col-houve-terceiro').value = item.colHouveTerceiro || 'Nao';
            toggleTerceiro();
            document.getElementById('col-houve-vitima').value = item.colHouveVitima || 'Nao';
            toggleVitima();
            
            const containerVitimas = document.getElementById('container-vitimas');
            containerVitimas.innerHTML = '';
            if (item.colHouveVitima === 'Sim' && item.colVitimas) {
                try {
                    const vitimas = JSON.parse(item.colVitimas);
                    if (Array.isArray(vitimas) && vitimas.length > 0) {
                        vitimas.forEach(v => adicionarVitima(v));
                    } else { adicionarVitima(); }
                } catch(e) { adicionarVitima(); } 
            } else { adicionarVitima(); }
        }
    } else if (item.tipo === 'Desvio') {
        document.getElementById('desv-empresa').value = item.empresa || '';
        const linhasAfetadas = item.linha ? item.linha.split(', ') : [];
        document.querySelectorAll('.linha-checkbox').forEach(chk => {
            chk.checked = linhasAfetadas.includes(chk.value);
        });
    } else if (item.tipo === 'Atraso') {
        document.getElementById('atr-empresa').value = item.empresa || '';
        atualizarLinhasAtraso();
        setTimeout(() => { document.getElementById('atr-linha').value = item.linha || ''; }, 100);
        document.getElementById('atr-prefixo').value = (item.prefixo && item.prefixo !== 'VÁRIOS') ? item.prefixo : '';
    }

    const modalDetalhesEl = document.getElementById('modalDetalhes');
    if (modalDetalhesEl && modalDetalhesEl.classList.contains('show')) {
        const inst = bootstrap.Modal.getInstance(modalDetalhesEl);
        if (inst) inst.hide();
    }
    
    new bootstrap.Modal(document.getElementById('modalOcorrencia')).show();
}

function verDetalhes(id) {
    const item = listaOcorrencias.find(i => i.id === id);
    if (!item) return;

    const corpo = document.getElementById('corpo-detalhes');
    let html = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h3 class="text-primary fw-bold mb-0">${item.protocolo}</h3>
            <span class="badge ${item.status === 'Finalizada' ? 'bg-success' : 'bg-danger'} p-2 fs-6">${item.status || 'Pendente'}</span>
        </div>
        <div class="text-center mb-4"><span class="badge bg-dark">${item.tipo}</span></div>
        <hr>
    `;

    if (item.tipo === 'Mecânica') {
        html += `
            <div class="row g-3">
                <div class="col-6"><strong>Carro:</strong> ${item.prefixo}</div>
                <div class="col-6"><strong>Linha:</strong> ${item.linha}</div>
                <div class="col-6"><strong>Início:</strong> ${item.mecDataInicio} às ${item.mecHoraInicio}</div>
                <div class="col-6"><strong>Fim:</strong> ${item.mecDataFim || '--/--/----'} às ${item.mecHoraFim || '--:--'}</div>
                <div class="col-6"><strong>Município:</strong> ${item.mecMunicipio}</div>
                <div class="col-6"><strong>Local:</strong> ${item.mecLocal}</div>
                <div class="col-12 bg-light p-2 border"><strong>Defeito:</strong> ${item.mecDefeito}</div>
                
                <div class="col-12 mt-3"><h6 class="fw-bold border-bottom pb-1 text-secondary">Impacto na Operação</h6></div>
                <div class="col-12"><strong>Partida Interrompida?</strong> ${item.mecPartidaInterrompida || 'Não'}</div>
                <div class="col-6"><strong>Viagens Canceladas (Ida):</strong> ${item.mecCanceladasIda || '0'}</div>
                <div class="col-6"><strong>Viagens Canceladas (Volta):</strong> ${item.mecCanceladasVolta || '0'}</div>
                
                <div class="col-12 mt-3"><h6 class="fw-bold border-bottom pb-1 text-secondary">Providência Tomada</h6></div>
                <div class="col-12"><strong>Ação Principal:</strong> <span class="badge bg-secondary">${item.mecProvidencia}</span></div>
        `;
        if (item.mecProvidencia === 'Reassumiu') {
            html += `
                <div class="col-12">
                    <div class="bg-light p-2 border rounded border-secondary">
                        <strong><i class='bx bx-refresh'></i> Detalhes - Reassumiu a Viagem</strong><br>
                        Sentido: <span class="text-primary fw-bold">${item.mecReassumiuSentido || '---'}</span> | 
                        Horário: <span class="text-primary fw-bold">${item.mecReassumiuHorario || '---'}</span>
                    </div>
                </div>
            `;
        } else if (item.mecProvidencia === 'Substituido') {
            html += `
                <div class="col-12">
                    <div class="bg-warning-subtle p-2 border rounded border-warning">
                        <strong><i class='bx bx-transfer'></i> Detalhes - Carro Substituído</strong><br>
                        Prefixo Substituto: <span class="text-danger fw-bold">${item.mecSubstPrefixo || '---'}</span><br>
                        Sentido: <span class="text-dark fw-bold">${item.mecSubstSentido || '---'}</span> | 
                        Horário: <span class="text-dark fw-bold">${item.mecSubstHorario || '---'}</span>
                    </div>
                </div>
            `;
        }
        html += `</div>`;
    } 
    else if (item.tipo === 'Desvio') {
        html += `
            <div class="row g-3">
                <div class="col-12 text-primary fw-bold">LINHAS AFETADAS:</div>
                <div class="col-12 bg-light p-2 small">${item.linha}</div>
                <div class="col-12"><strong>Carros Retidos/Envolvidos:</strong> ${item.desvCarros || 'Nenhum informado'}</div>
                <div class="col-6"><strong>Início:</strong> ${item.desvDataInicio} às ${item.desvHoraInicio}</div>
                <div class="col-6"><strong>Fim:</strong> ${item.desvDataFim || '--/--/----'} às ${item.desvHoraFim || '--:--'}</div>
                <div class="col-6"><strong>Município:</strong> ${item.desvMunicipio}</div>
                <div class="col-6"><strong>Local:</strong> ${item.desvLocal}</div>
                <div class="col-6"><strong>Sentido:</strong> ${item.desvSentido || '---'}</div>
                <div class="col-6"><strong>Pontos Desatendidos:</strong> ${item.desvPontosSem || 'Nenhum'}</div>
                <div class="col-12"><strong>Motivo:</strong> ${item.desvMotivo}</div>
                <div class="col-12 bg-light p-2 border"><strong>Rota Realizada:</strong> ${item.desvRota}</div>
                <div class="col-12"><strong>Observações:</strong> ${item.desvObs || 'Nenhuma observação'}</div>
            </div>
        `;
    }
    else if (item.tipo === 'Colisão') {
        html += `
            <div class="row g-3">
                <div class="col-6"><strong>Carro:</strong> ${item.prefixo}</div>
                <div class="col-6"><strong>Linha:</strong> ${item.linha}</div>
                <div class="col-6"><strong>Início:</strong> ${item.colDataInicio} às ${item.colHoraInicio}</div>
                <div class="col-6"><strong>Fim:</strong> ${item.colDataFim || '--/--/----'} às ${item.colHoraFim || '--:--'}</div>
                <div class="col-6"><strong>Município:</strong> ${item.colMunicipio}</div>
                <div class="col-6"><strong>Local:</strong> ${item.colLocal}</div>
                <div class="col-12 bg-light p-2 border"><strong>Condutor:</strong> ${item.colCondutorNome} (Mat: ${item.colCondutorMatricula})</div>
                <div class="col-12"><strong>Avaria Coletivo:</strong> ${item.colAvariaColetivo}</div>
                
                <div class="col-12 mt-3"><h6 class="fw-bold border-bottom pb-1 text-secondary">Impacto na Operação</h6></div>
                <div class="col-12"><strong>Partida Interrompida?</strong> ${item.colPartidaInterrompida || 'Não'}</div>
                <div class="col-6"><strong>Viagens Canceladas (Ida):</strong> ${item.colCanceladasIda || '0'}</div>
                <div class="col-6"><strong>Viagens Canceladas (Volta):</strong> ${item.colCanceladasVolta || '0'}</div>

                <div class="col-12 mt-3"><h6 class="fw-bold border-bottom pb-1 text-secondary">Providência Tomada</h6></div>
                <div class="col-12"><strong>Ação Principal:</strong> <span class="badge bg-secondary">${item.colProvidencia}</span></div>
        `;
        if (item.colProvidencia === 'Reassumiu') {
            html += `
                <div class="col-12">
                    <div class="bg-light p-2 border rounded border-secondary">
                        <strong><i class='bx bx-refresh'></i> Detalhes - Reassumiu a Viagem</strong><br>
                        Sentido: <span class="text-primary fw-bold">${item.colReassumiuSentido || '---'}</span> | 
                        Horário: <span class="text-primary fw-bold">${item.colReassumiuHorario || '---'}</span>
                    </div>
                </div>
            `;
        } else if (item.colProvidencia === 'Substituido') {
            html += `
                <div class="col-12">
                    <div class="bg-warning-subtle p-2 border rounded border-warning">
                        <strong><i class='bx bx-transfer'></i> Detalhes - Carro Substituído</strong><br>
                        Prefixo Substituto: <span class="text-danger fw-bold">${item.colSubstPrefixo || '---'}</span><br>
                        Sentido: <span class="text-dark fw-bold">${item.colSubstSentido || '---'}</span> | 
                        Horário: <span class="text-dark fw-bold">${item.colSubstHorario || '---'}</span>
                    </div>
                </div>
            `;
        }
        html += `</div>`; 

        if (item.colHouveTerceiro === 'Sim') {
            html += `
                <h6 class="mt-4 fw-bold text-primary border-bottom pb-1">DADOS DO TERCEIRO</h6>
                <div class="row g-2 small bg-light p-2 border rounded">
                    <div class="col-4"><strong>Modelo:</strong> ${item.colTercModelo || '---'}</div>
                    <div class="col-4"><strong>Cor:</strong> ${item.colTercCor || '---'}</div>
                    <div class="col-4"><strong>Placa:</strong> <span class="badge bg-dark">${item.colTercPlaca || '---'}</span></div>
                    <div class="col-6"><strong>Nome:</strong> ${item.colTercNome || '---'}</div>
                    <div class="col-6"><strong>Telefone:</strong> ${item.colTercTel || '---'}</div>
                    <div class="col-12"><strong>Endereço:</strong> ${item.colTercEnd || '---'}</div>
                </div>
            `;
        }

        if (item.colHouveVitima === 'Sim' && item.colVitimas) {
            html += `<h6 class="mt-4 fw-bold text-danger border-bottom pb-1">VÍTIMAS DA COLISÃO</h6>`;
            try {
                const vitimas = JSON.parse(item.colVitimas);
                vitimas.forEach((v, index) => {
                    html += `
                        <div class="bg-danger-subtle p-2 rounded mb-2 small border border-danger">
                            <strong class="text-danger">Vítima ${index + 1}:</strong><br>
                            <strong>Nome:</strong> ${v.nome || 'Não informado'} | <strong>Idade:</strong> ${v.idade || '--'}<br>
                            <strong>CPF/RG:</strong> ${v.doc || 'Não informado'}<br>
                            <strong>Estado:</strong> ${v.estado || '---'}<br>
                            <strong>Socorrida Para:</strong> ${v.socorro || '---'}
                        </div>
                    `;
                });
            } catch(e) { html += `<div>Erro ao carregar dados das vítimas.</div>`; }
        }

        html += `<h6 class="mt-4 fw-bold border-bottom pb-1">AUTORIDADES / REGISTROS</h6>
                 <div class="small bg-light p-2 border rounded">`;
        if (item.colGcm) html += `<div><strong>GCM:</strong> ${item.colGcm}</div>`;
        if (item.colPm) html += `<div><strong>PM:</strong> ${item.colPm}</div>`;
        if (item.colSamu) html += `<div><strong>SAMU:</strong> ${item.colSamu}</div>`;
        if (item.colBo) html += `<div><strong>B.O.:</strong> ${item.colBo}</div>`;
        html += `</div>`;
    }
    else if (item.tipo === 'Atraso') {
        html += `
            <div class="row g-3">
                <div class="col-6"><strong>Empresa:</strong> ${item.empresa}</div>
                <div class="col-6"><strong>Linha:</strong> ${item.linha}</div>
                <div class="col-6"><strong>Carro(s):</strong> ${item.prefixo || 'VÁRIOS'}</div>
                <div class="col-6 text-danger"><strong>Maior Atraso:</strong> ${item.atrMinutos} Minutos</div>
                <div class="col-6"><strong>Início:</strong> ${item.atrDataInicio} às ${item.atrHoraInicio}</div>
                <div class="col-6"><strong>Fim:</strong> ${item.atrDataFim || '--/--/----'} às ${item.atrHoraFim || '--:--'}</div>
                <div class="col-6"><strong>Município:</strong> ${item.atrMunicipio}</div>
                <div class="col-6"><strong>Local:</strong> ${item.atrLocal}</div>
                <div class="col-6"><strong>Sentido:</strong> ${item.atrSentido}</div>
                <div class="col-12 bg-light p-2 border"><strong>Motivo:</strong> ${item.atrMotivo}</div>
                <div class="col-12"><strong>Observações:</strong> ${item.atrObs || '---'}</div>
            </div>
        `;
    }

    html += `<hr><div class="small mt-4 bg-white p-3 rounded border border-secondary shadow-sm">
             <div class="fw-bold text-dark border-bottom pb-1 mb-2"><i class='bx bxs-check-shield'></i> AUDITORIA E HISTÓRICO</div>
             <div class="mb-2"><i class='bx bx-user'></i> <strong>Criado originalmente por:</strong> ${item.criadoPor || 'Sistema'}</div>`;
             
    if (item.historico && item.historico.length > 0) {
        html += `<div class="fw-bold text-muted mt-3 mb-1"><i class='bx bx-history'></i> Alterações:</div>
                 <ul class="mb-0 ps-3">`;
        item.historico.forEach(h => {
            html += `<li class="mt-2 text-dark">${h.dataHora} - <strong>${h.usuario}</strong> alterou:<ul>`;
            h.mudancas.forEach(m => {
                html += `<li>Campo <em class="text-secondary">${m.campo}</em>: de <span class="text-danger fw-bold">${m.de}</span> para <span class="text-success fw-bold">${m.para}</span></li>`;
            });
            html += `</ul></li>`;
        });
        html += `</ul>`;
    } else {
        html += `<div class="text-muted fst-italic mt-2">Nenhuma edição realizada até o momento.</div>`;
    }
    html += `</div>`;

    corpo.innerHTML = html;
    
    const actions = document.getElementById('admin-actions');
    let botoes = `<button class="btn btn-warning btn-sm me-auto fw-bold text-dark shadow-sm" onclick="editarOcorrencia('${item.id}')"><i class='bx bx-edit'></i> Editar</button>`;
    if (usuarioAtual && usuarioAtual.role === 'admin') {
        botoes += `<button class="btn btn-outline-danger btn-sm" onclick="excluirOcorrencia('${item.id}')"><i class='bx bx-trash'></i> Excluir</button>`;
    }
    actions.innerHTML = botoes;

    new bootstrap.Modal(document.getElementById('modalDetalhes')).show();
}

async function carregarOcorrencias() {
    try {
        const token = localStorage.getItem('sico_token');
        const response = await fetch(`${API_URL}/ocorrencias`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.status === 401 || response.status === 403) {
            logout();
            return;
        }

        listaOcorrencias = await response.json();
        renderizarTabela(listaOcorrencias);
        atualizarKPIs(listaOcorrencias);
    } catch (error) {}
}

function renderizarTabela(dados) {
    const tbody = document.getElementById('tabela-corpo');
    tbody.innerHTML = '';

    dados.forEach(item => {
        let statusColor = item.status === 'Finalizada' ? 'bg-success' : 'bg-danger';
        let hora = item.mecHoraInicio || item.desvHoraInicio || item.colHoraInicio || item.atrHoraInicio || '--:--';
        let local = item.mecLocal || item.desvLocal || item.colLocal || item.atrLocal || '---';

        const classeLinhaEmpresa = (ESTILO_EMPRESA[item.empresa] || {}).linha || '';

        const tr = `
            <tr class="${classeLinhaEmpresa}">
                <td class="ps-4 fw-bold text-primary">${item.protocolo}</td>
                <td>${hora}</td>
                <td>
                    <div class="fw-bold">${item.prefixo}</div>
                    <small class="text-muted text-wrap" style="font-size: 0.75rem">${item.linha || '---'}</small>
                </td>
                <td>${item.tipo}</td>
                <td><small>${local}</small></td>
                <td><span class="badge ${statusColor}">${item.status || 'Pendente'}</span></td>
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-light border text-primary" onclick="verDetalhes('${item.id}')" title="Ver Detalhes"><i class='bx bx-show'></i></button>
                    <button class="btn btn-sm btn-warning text-dark ms-1 shadow-sm" onclick="editarOcorrencia('${item.id}')" title="Editar"><i class='bx bx-edit-alt'></i></button>
                    ${usuarioAtual && usuarioAtual.role === 'admin' ? `<button class="btn btn-sm btn-outline-danger ms-1" onclick="excluirOcorrencia('${item.id}')" title="Excluir"><i class='bx bx-trash'></i></button>` : ''}
                </td>
            </tr>
        `;
        tbody.innerHTML += tr;
    });
}

async function excluirOcorrencia(id) {
    if(!confirm("Tem certeza que deseja APAGAR esta ocorrência definitivamente?")) return;
    
    try {
        const token = localStorage.getItem('sico_token');
        const response = await fetch(`${API_URL}/ocorrencias/${id}`, { 
            method: 'DELETE',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const modalDetalhesEl = document.getElementById('modalDetalhes');
            if (modalDetalhesEl && modalDetalhesEl.classList.contains('show')) {
                const inst = bootstrap.Modal.getInstance(modalDetalhesEl);
                if (inst) inst.hide();
            }
            alert("🗑️ Ocorrência apagada com sucesso!");
            carregarOcorrencias();
        } else {
            const erro = await response.json();
            alert("❌ Erro ao excluir: " + (erro.error || "Acesso negado."));
        }
    } catch(e) {
        alert("Erro de conexão com o servidor ao tentar excluir.");
    }
}

function aplicarFiltros() {
    const buscaPrefixo = document.getElementById('filtro-prefixo').value.toLowerCase();
    const buscaLinha = document.getElementById('filtro-linha').value.toLowerCase();
    const buscaTipo = document.getElementById('filtro-tipo').value;
    const buscaStatus = document.getElementById('filtro-status').value;

    const filtrados = listaOcorrencias.filter(item => {
        const matchPrefixo = (item.prefixo || '').toLowerCase().includes(buscaPrefixo) || (item.desvCarros && item.desvCarros.includes(buscaPrefixo));
        const matchLinha = (item.linha || '').toLowerCase().includes(buscaLinha);
        const matchTipo = buscaTipo === "" || item.tipo === buscaTipo;
        const statusItem = item.status || 'Pendente';
        const matchStatus = buscaStatus === "" || statusItem === buscaStatus;
        
        return matchPrefixo && matchLinha && matchTipo && matchStatus;
    });

    renderizarTabela(filtrados);
}

function atualizarKPIs(dados) {
    document.getElementById('kpi-total').innerText = dados.length;
    const pendentes = dados.filter(i => (i.status || 'Pendente') === 'Pendente').length;
    document.getElementById('kpi-pendentes').innerText = pendentes;
}

function gerarRelatorioZap() {
    if (listaOcorrencias.length === 0) return alert("Nada para relatar!");
    const hoje = new Date().toLocaleDateString();
    let texto = `🚨 *BOLETIM SICO - ${hoje}*\n\n`;

    listaOcorrencias.forEach(item => {
        let iconeStatus = item.status === 'Finalizada' ? '✅' : '🔴';
        texto += `📌 *${item.protocolo}* ${iconeStatus}\n`;
        
        if (item.tipo === 'Desvio') {
            texto += `🚧 *DESVIO DE ITINERÁRIO*\n`;
            texto += `📍 ${item.desvLocal}\n`;
            texto += `🚌 Linhas: ${item.linha}\n`;
            texto += `⚠️ Motivo: ${item.desvMotivo}\n`;
        } else if (item.tipo === 'Mecânica') {
            texto += `🔧 *FALHA MECÂNICA*\n`;
            texto += `🚌 ${item.prefixo} (${item.linha})\n`;
            texto += `📍 ${item.mecLocal}\n`;
            texto += `🛠️ Defeito: ${item.mecDefeito}\n`;
        } else if (item.tipo === 'Colisão') {
            texto += `💥 *COLISÃO*\n`;
            texto += `🚌 ${item.prefixo} (${item.linha})\n`;
            texto += `📍 ${item.colLocal}\n`;
        } else if (item.tipo === 'Atraso') {
            texto += `⏱️ *ATRASO DE PARTIDA*\n`;
            texto += `🚌 Linha: ${item.linha} (${item.empresa})\n`;
            texto += `📍 ${item.atrLocal}\n`;
            texto += `⚠️ Motivo: ${item.atrMotivo}\n`;
        } else {
            texto += `⚠️ ${item.tipo}\n`;
        }
        texto += `\n`;
    });
    texto += `Total: ${listaOcorrencias.length}`;
    navigator.clipboard.writeText(texto).then(() => alert("📋 Resumo copiado!"));
}

async function exportarCSV() {
    const token = localStorage.getItem('sico_token');
    try {
        const response = await fetch(`${API_URL}/exportar`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error("Erro na exportação");
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "relatorio_sico_v2.csv";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (e) {
        alert("Erro ao exportar o CSV. Você está logado?");
    }
}

// ===================== GESTÃO DE USUÁRIOS (somente admin) =====================
function mostrarVisaoUsuarios(visao) {
    ['lista', 'form', 'reset'].forEach(v => {
        document.getElementById('usuarios-' + v).classList.toggle('d-none', v !== visao);
    });
}

function abrirGestaoUsuarios() {
    if (!usuarioAtual || usuarioAtual.role !== 'admin') return;
    mostrarVisaoUsuarios('lista');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalUsuarios')).show();
    carregarUsuarios();
}

async function carregarUsuarios() {
    try {
        const response = await fetch(`${API_URL}/usuarios`, { headers: cabecalhoAuth() });
        if (response.status === 401 || response.status === 403) { logout(); return; }
        if (!response.ok) throw new Error('usuarios');
        listaUsuarios = await response.json();
        renderizarUsuarios();
    } catch (e) {
        alert('Erro ao carregar a lista de usuários.');
    }
}

function renderizarUsuarios() {
    const tbody = document.getElementById('tabela-usuarios');
    tbody.innerHTML = listaUsuarios.map(u => {
        const eu = u.login === usuarioAtual.login;
        const empresas = u.role === 'admin'
            ? 'Todas'
            : u.empresas.map(e => (ESTILO_EMPRESA[e] || {}).curto || e).join(', ');
        const situacao = u.ativo
            ? '<span class="badge bg-success">Ativo</span>'
            : '<span class="badge bg-secondary">Desativado</span>';
        const provisoria = u.precisaTrocarSenha
            ? ' <span class="badge bg-warning text-dark" title="Ainda não trocou a senha provisória">Senha provisória</span>'
            : '';
        const botoesRestritos = eu ? '' : `
            <button class="btn btn-sm btn-outline-secondary ms-1" onclick="alternarAtivo('${u.id}', ${!u.ativo})" title="${u.ativo ? 'Desativar' : 'Reativar'}">
                <i class='bx ${u.ativo ? 'bx-block' : 'bx-check-circle'}'></i>
            </button>
            <button class="btn btn-sm btn-outline-danger ms-1" onclick="excluirUsuario('${u.id}')" title="Excluir"><i class='bx bx-trash'></i></button>`;
        return `
            <tr class="${u.ativo ? '' : 'text-muted'}">
                <td class="fw-bold">${esc(u.nome)}${eu ? ' <small class="text-muted">(você)</small>' : ''}</td>
                <td>${esc(u.login)}</td>
                <td>${u.role === 'admin' ? 'Administrador' : 'Operador'}</td>
                <td><small>${esc(empresas)}</small></td>
                <td>${situacao}${provisoria}</td>
                <td class="text-end text-nowrap">
                    <button class="btn btn-sm btn-light border text-primary" onclick="editarUsuario('${u.id}')" title="Editar"><i class='bx bx-edit-alt'></i></button>
                    <button class="btn btn-sm btn-light border ms-1" onclick="abrirResetSenha('${u.id}')" title="Redefinir senha"><i class='bx bx-key'></i></button>
                    ${botoesRestritos}
                </td>
            </tr>`;
    }).join('');
}

function definirEmpresasForm(lista) {
    document.querySelectorAll('.usuario-emp-check').forEach(c => {
        c.checked = c.value === 'CDA' || lista.includes(c.value);
    });
}

function atualizarVisaoEmpresasForm() {
    const admin = document.getElementById('usuario-role').value === 'admin';
    document.getElementById('bloco-empresas-usuario').classList.toggle('d-none', admin);
    document.getElementById('aviso-admin-empresas').classList.toggle('d-none', !admin);
}

function aplicarPreset(tipo) {
    definirEmpresasForm(tipo === 'pirajucara' ? ['Fervima', 'Pirajuçara', 'CDA'] : ['CDA']);
}

function gerarSenhaNo(idCampo) {
    const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const sorteio = new Uint32Array(8);
    crypto.getRandomValues(sorteio);
    document.getElementById(idCampo).value = Array.from(sorteio, n => letras[n % letras.length]).join('');
}

function novoUsuario() {
    document.getElementById('form-usuario').reset();
    document.getElementById('usuario-id').value = '';
    document.getElementById('titulo-form-usuario').innerText = 'Novo usuário';
    document.getElementById('usuario-login').disabled = false;
    document.getElementById('grupo-senha-usuario').classList.remove('d-none');
    document.getElementById('usuario-senha').required = true;
    definirEmpresasForm(['CDA']);
    atualizarVisaoEmpresasForm();
    mostrarVisaoUsuarios('form');
}

function editarUsuario(id) {
    const u = listaUsuarios.find(x => x.id === id);
    if (!u) return;
    document.getElementById('form-usuario').reset();
    document.getElementById('usuario-id').value = u.id;
    document.getElementById('titulo-form-usuario').innerText = 'Editar usuário';
    document.getElementById('usuario-nome').value = u.nome;
    document.getElementById('usuario-login').value = u.login;
    document.getElementById('usuario-login').disabled = true;
    document.getElementById('usuario-role').value = u.role;
    document.getElementById('grupo-senha-usuario').classList.add('d-none');
    document.getElementById('usuario-senha').required = false;
    definirEmpresasForm(u.empresas);
    atualizarVisaoEmpresasForm();
    mostrarVisaoUsuarios('form');
}

document.getElementById('form-usuario').addEventListener('submit', async function(e) {
    e.preventDefault();
    const id = document.getElementById('usuario-id').value;
    const corpo = {
        nome: document.getElementById('usuario-nome').value.trim(),
        role: document.getElementById('usuario-role').value,
        empresasPermitidas: Array.from(document.querySelectorAll('.usuario-emp-check:checked')).map(c => c.value)
    };
    let url = `${API_URL}/usuarios`;
    let method = 'POST';
    if (id) {
        url += `/${id}`;
        method = 'PUT';
    } else {
        corpo.login = document.getElementById('usuario-login').value.trim();
        corpo.senha = document.getElementById('usuario-senha').value;
    }

    try {
        const response = await fetch(url, { method, headers: cabecalhoAuth(true), body: JSON.stringify(corpo) });
        const dados = await response.json().catch(() => ({}));
        if (response.ok) {
            mostrarVisaoUsuarios('lista');
            carregarUsuarios();
            alert(id ? '✅ Usuário atualizado!' : '✅ Usuário criado! Ele precisará trocar a senha no primeiro acesso.');
        } else {
            alert('❌ ' + (dados.error || 'Erro ao salvar o usuário.'));
        }
    } catch (err) {
        alert('Erro de conexão com o servidor.');
    }
});

function abrirResetSenha(id) {
    const u = listaUsuarios.find(x => x.id === id);
    if (!u) return;
    document.getElementById('reset-usuario-id').value = u.id;
    document.getElementById('reset-usuario-nome').innerText = `${u.nome} (${u.login})`;
    document.getElementById('reset-senha').value = '';
    mostrarVisaoUsuarios('reset');
}

document.getElementById('form-reset-senha').addEventListener('submit', async function(e) {
    e.preventDefault();
    const id = document.getElementById('reset-usuario-id').value;
    const senhaNova = document.getElementById('reset-senha').value;
    try {
        const response = await fetch(`${API_URL}/usuarios/${id}/resetar-senha`, {
            method: 'POST',
            headers: cabecalhoAuth(true),
            body: JSON.stringify({ senhaNova })
        });
        const dados = await response.json().catch(() => ({}));
        if (response.ok) {
            alert(`✅ Senha redefinida!\n\nNova senha provisória: ${senhaNova}\n\nPasse para a pessoa. No próximo acesso ela terá que criar uma senha nova.`);
            mostrarVisaoUsuarios('lista');
            carregarUsuarios();
        } else {
            alert('❌ ' + (dados.error || 'Erro ao redefinir a senha.'));
        }
    } catch (err) {
        alert('Erro de conexão com o servidor.');
    }
});

async function alternarAtivo(id, ativo) {
    const u = listaUsuarios.find(x => x.id === id);
    if (!u) return;
    const pergunta = ativo
        ? `Reativar o acesso de ${u.nome}?`
        : `Desativar o acesso de ${u.nome}? Ela perde o acesso na hora, mas o histórico das ocorrências é mantido.`;
    if (!confirm(pergunta)) return;
    try {
        const response = await fetch(`${API_URL}/usuarios/${id}`, {
            method: 'PUT',
            headers: cabecalhoAuth(true),
            body: JSON.stringify({ ativo })
        });
        const dados = await response.json().catch(() => ({}));
        if (!response.ok) alert('❌ ' + (dados.error || 'Erro ao alterar o usuário.'));
        carregarUsuarios();
    } catch (err) {
        alert('Erro de conexão com o servidor.');
    }
}

async function excluirUsuario(id) {
    const u = listaUsuarios.find(x => x.id === id);
    if (!u) return;
    if (!confirm(`Excluir DEFINITIVAMENTE o login de ${u.nome} (${u.login})?\n\nSe preferir apenas bloquear o acesso, use o botão "Desativar".`)) return;
    try {
        const response = await fetch(`${API_URL}/usuarios/${id}`, { method: 'DELETE', headers: cabecalhoAuth() });
        const dados = await response.json().catch(() => ({}));
        if (!response.ok) alert('❌ ' + (dados.error || 'Erro ao excluir o usuário.'));
        carregarUsuarios();
    } catch (err) {
        alert('Erro de conexão com o servidor.');
    }
}

// ===================== TROCA DE SENHA =====================
function abrirTrocarSenha(obrigatoria) {
    document.getElementById('form-trocar-senha').reset();
    document.getElementById('trocar-senha-erro').classList.add('d-none');
    document.getElementById('aviso-troca-obrigatoria').classList.toggle('d-none', !obrigatoria);
    document.getElementById('btn-sair-troca').classList.toggle('d-none', !obrigatoria);
    document.getElementById('btn-cancelar-troca').classList.toggle('d-none', !!obrigatoria);
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalTrocarSenha')).show();
}

document.getElementById('form-trocar-senha').addEventListener('submit', async function(e) {
    e.preventDefault();
    const erroEl = document.getElementById('trocar-senha-erro');
    const senhaAtual = document.getElementById('troca-senha-atual').value;
    const senhaNova = document.getElementById('troca-senha-nova').value;
    const confirmacao = document.getElementById('troca-senha-confirma').value;

    const mostrarErro = msg => { erroEl.textContent = msg; erroEl.classList.remove('d-none'); };
    if (senhaNova.length < 6) return mostrarErro('A nova senha precisa ter pelo menos 6 caracteres.');
    if (senhaNova !== confirmacao) return mostrarErro('A confirmação não é igual à nova senha.');

    try {
        const response = await fetch(`${API_URL}/minha-senha`, {
            method: 'POST',
            headers: cabecalhoAuth(true),
            body: JSON.stringify({ senhaAtual, senhaNova })
        });
        const dados = await response.json().catch(() => ({}));
        if (response.ok) {
            localStorage.removeItem('sico_trocar_senha');
            bootstrap.Modal.getInstance(document.getElementById('modalTrocarSenha')).hide();
            alert('✅ Senha alterada com sucesso!');
        } else {
            mostrarErro(dados.error || 'Erro ao alterar a senha.');
        }
    } catch (err) {
        mostrarErro('Erro de conexão com o servidor.');
    }
});

restaurarSessao();
const API_URL = '/api';

let usuarioAtual = null;
let listaOcorrencias = [];

const linhasFervima = ['Circular 02', 'Circular 03', 'Circular 04', 'Circular 07.1', 'Circular 07.2', 'Circular 08'];
const linhasPirajucara = ['Circular 05', 'Circular 06', 'Circular 09', 'Circular 09.1'];
const todasLinhas = [...linhasFervima, ...linhasPirajucara];

function restaurarSessao() {
    const token = localStorage.getItem('sico_token');
    if (!token) return;

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp * 1000 < Date.now()) {
            logout();
            return;
        }
        usuarioAtual = { nome: payload.nome || payload.login, role: payload.role, login: payload.login };
        document.getElementById('login-screen').classList.add('d-none');
        document.getElementById('dashboard-screen').classList.remove('d-none');
        document.getElementById('user-display').innerText = `Olá, ${usuarioAtual.nome}`;
        carregarOcorrencias();
        gerarCheckboxesLinhas();
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
            restaurarSessao();
        } else {
            document.getElementById('login-erro').classList.remove('d-none');
        }
    } catch (error) { alert("Erro de conexão."); }
});

function logout() { 
    localStorage.removeItem('sico_token');
    location.reload(); 
}

function prepararNovaOcorrencia() {
    document.getElementById('form-ocorrencia').reset();
    document.getElementById('ocorrencia-id').value = "";
    document.getElementById('titulo-modal-ocorrencia').innerHTML = "<i class='bx bx-plus-circle'></i> Nova Ocorrência";
    document.getElementById('tipo').disabled = false;
    
    document.getElementById('container-vitimas').innerHTML = '';
    adicionarVitima(); 

    ajustarFormulario();
}

function gerarCheckboxesLinhas() {
    const container = document.getElementById('container-linhas-check');
    if(container) {
        container.innerHTML = '';
        todasLinhas.forEach(linha => {
            const div = document.createElement('div');
            div.className = 'col-6 col-md-4';
            div.innerHTML = `
                <div class="form-check">
                    <input class="form-check-input linha-checkbox" type="checkbox" value="${linha}" id="chk-${linha.replace(/\s/g, '')}">
                    <label class="form-check-label" for="chk-${linha.replace(/\s/g, '')}">${linha}</label>
                </div>
            `;
            container.appendChild(div);
        });
    }
}

function verificarEmpresa() {
    const prefixo = document.getElementById('prefixo').value;
    const badge = document.getElementById('empresa-badge');
    const selectLinha = document.getElementById('linha');

    selectLinha.innerHTML = '<option value="">Selecione...</option>';
    
    // LISTAS DE CARROS ADICIONADAS AQUI PARA VALIDAÇÃO LOCAL!
    const frotaFervima = ['677', '678', '679', '680', '681', '682', '683', '684', '686', '687', '688', '689', '690', '691', '692', '693', '694', '695', '697', '698', '699', '700', '701', '702', '703', '704', '705', '706', '707', '708', '709', '710', '711', '712', '714', '715', '716', '717', '718', '719', '720', '721', '722', '723', '724', '725', '726', '727', '728', '729', '730', '731', '732', '733'];
    const frotaPirajucara = ['868', '869', '870', '871', '872', '873', '875', '877', '879', '880', '881', '882', '883', '884', '885', '886', '887', '888', '889', '890', '891', '892', '893', '894', '895', '896', '897', '898', '899', '900', '901', '902', '903', '904', '906', '907', '908', '910', '911', '912', '913'];

    if (frotaFervima.includes(prefixo)) {
        badge.innerText = "FERVIMA";
        badge.className = "badge bg-warning text-dark mt-1 w-100";
        selectLinha.disabled = false;
        linhasFervima.forEach(l => selectLinha.innerHTML += `<option value="${l}">${l}</option>`);
    } else if (frotaPirajucara.includes(prefixo)) {
        badge.innerText = "PIRAJUÇARA";
        badge.className = "badge bg-primary mt-1 w-100";
        selectLinha.disabled = false;
        linhasPirajucara.forEach(l => selectLinha.innerHTML += `<option value="${l}">${l}</option>`);
    } else {
        badge.innerText = "---";
        badge.className = "badge bg-secondary mt-1 w-100";
        selectLinha.disabled = true;
    }
}

function atualizarLinhasAtraso() {
    const empresa = document.getElementById('atr-empresa').value;
    const selectLinha = document.getElementById('atr-linha');
    selectLinha.innerHTML = '<option value="">Selecione...</option>';
    selectLinha.disabled = true;

    if (empresa === 'Fervima') {
        selectLinha.disabled = false;
        linhasFervima.forEach(l => selectLinha.innerHTML += `<option value="${l}">${l}</option>`);
    } else if (empresa === 'Pirajuçara') {
        selectLinha.disabled = false;
        linhasPirajucara.forEach(l => selectLinha.innerHTML += `<option value="${l}">${l}</option>`);
    }
}

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
        const linhasAfetadas = item.linha ? item.linha.split(', ') : [];
        document.querySelectorAll('.linha-checkbox').forEach(chk => {
            chk.checked = linhasAfetadas.includes(chk.value);
        });
    } else if (item.tipo === 'Atraso') {
        document.getElementById('atr-empresa').value = item.empresa || '';
        atualizarLinhasAtraso();
        setTimeout(() => { document.getElementById('atr-linha').value = item.linha || ''; }, 100);
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
                <div class="col-12"><strong>Ação:</strong> <span class="badge bg-secondary">${item.mecProvidencia}</span></div>
        `;
        if (item.mecProvidencia === 'Reassumiu') {
            html += `
                <div class="col-6"><strong>Sentido:</strong> ${item.mecReassumiuSentido}</div>
                <div class="col-6"><strong>Horário:</strong> ${item.mecReassumiuHorario}</div>
            `;
        } else if (item.mecProvidencia === 'Substituido') {
            html += `
                <div class="col-4"><strong>Carro Subst.:</strong> ${item.mecSubstPrefixo}</div>
                <div class="col-4"><strong>Sentido:</strong> ${item.mecSubstSentido}</div>
                <div class="col-4"><strong>Horário:</strong> ${item.mecSubstHorario}</div>
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
                <div class="col-12"><strong>Ação:</strong> <span class="badge bg-secondary">${item.colProvidencia}</span></div>
        `;
        if (item.colProvidencia === 'Reassumiu') {
            html += `
                <div class="col-6"><strong>Sentido:</strong> ${item.colReassumiuSentido}</div>
                <div class="col-6"><strong>Horário:</strong> ${item.colReassumiuHorario}</div>
            `;
        } else if (item.colProvidencia === 'Substituido') {
            html += `
                <div class="col-4"><strong>Carro Subst.:</strong> ${item.colSubstPrefixo}</div>
                <div class="col-4"><strong>Sentido:</strong> ${item.colSubstSentido}</div>
                <div class="col-4"><strong>Horário:</strong> ${item.colSubstHorario}</div>
            `;
        }
        html += `</div>`; 

        if (item.colHouveTerceiro === 'Sim') {
            html += `
                <h6 class="mt-4 fw-bold text-primary border-bottom pb-1">DADOS DO TERCEIRO</h6>
                <div class="row g-2 small">
                    <div class="col-4"><strong>Modelo:</strong> ${item.colTercModelo || '---'}</div>
                    <div class="col-4"><strong>Cor:</strong> ${item.colTercCor || '---'}</div>
                    <div class="col-4"><strong>Placa:</strong> ${item.colTercPlaca || '---'}</div>
                    <div class="col-6"><strong>Nome:</strong> ${item.colTercNome || '---'}</div>
                    <div class="col-6"><strong>Telefone:</strong> ${item.colTercTel || '---'}</div>
                    <div class="col-12"><strong>Endereço:</strong> ${item.colTercEnd || '---'}</div>
                </div>
            `;
        }

        if (item.colHouveVitima === 'Sim' && item.colVitimas) {
            html += `<h6 class="mt-4 fw-bold text-danger border-bottom pb-1">VÍTIMAS</h6>`;
            try {
                const vitimas = JSON.parse(item.colVitimas);
                vitimas.forEach((v, index) => {
                    html += `
                        <div class="bg-danger-subtle p-2 rounded mb-2 small border border-danger">
                            <strong>${index + 1}. Nome:</strong> ${v.nome || '--'} | <strong>Idade:</strong> ${v.idade || '--'} | <strong>Doc:</strong> ${v.doc || '--'}<br>
                            <strong>Estado:</strong> ${v.estado || '--'} | <strong>Socorro:</strong> ${v.socorro || '--'}
                        </div>
                    `;
                });
            } catch(e) { html += `<div>Erro ao carregar dados das vítimas.</div>`; }
        }

        html += `<h6 class="mt-4 fw-bold border-bottom pb-1">AUTORIDADES / REGISTROS</h6>
                 <div class="small">`;
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

        const tr = `
            <tr>
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
        const matchPrefixo = item.prefixo.toLowerCase().includes(buscaPrefixo) || (item.desvCarros && item.desvCarros.includes(buscaPrefixo));
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

restaurarSessao();

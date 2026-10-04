const supabase = require('./supabase');

async function registrarOcorrencia() {
  console.log('Enviando dados da ocorrência para a nuvem...');

  const { error } = await supabase
    .from('ocorrencias')
    .insert([
      {
        horario_ocorrencia: '08:15:00',
        numero_carro: '112233',
        linha: '056',
        sentido: 'Ida',
        motorista: 'Carlos Souza',
        local_evento: 'Rodovia Régis Bittencourt, Km 279',
        tipo_ocorrencia: 'Quebra - Superaquecimento',
        descricao: 'Veículo perdeu a força e precisou encostar. Manutenção acionada via rádio.',
        perda_viagem: 'Sim',
        carro_substituto: '112250'
      }
    ]);

  if (error) {
    console.error('❌ Erro ao salvar a ocorrência:', error.message);
  } else {
    console.log('✅ Ocorrência salva com sucesso no banco de dados!');
  }
}

registrarOcorrencia();
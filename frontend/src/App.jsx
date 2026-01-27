import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import './App.css'

// --- LISTA COMPLETA DE CONTRATOS (DROPDOWN INTELIGENTE) ---
const OPCOES_CONTRATOS = [
  "Financiamento de Veículo (CDC)",
  "Leasing (Arrendamento Mercantil)",
  "Financiamento com Alienação Fiduciária",
  "Refinanciamento de Veículo",
  "Portabilidade de Financiamento de Veículo",
  "Empréstimo Pessoal (Não Consignado)",
  "Empréstimo Pessoal com Garantia",
  "Empréstimo Consignado (INSS)",
  "Empréstimo Consignado (CLT Privado)",
  "Empréstimo Consignado (Servidor Público)",
  "Empréstimo Consignado (Militar)",
  "Empréstimo com Garantia de Veículo",
  "Empréstimo com Garantia de Imóvel (Home Equity)",
  "Financiamento Imobiliário (SFH)",
  "Financiamento Imobiliário (SFI)",
  "Consórcio Imobiliário",
  "Refinanciamento Imobiliário",
  "Cartão de Crédito Rotativo",
  "Cartão de Crédito Parcelado",
  "Cartão de Crédito Consignado (RMC)",
  "Cartão Benefício Consignado",
  "Cheque Especial",
  "Limite de Conta Corrente",
  "Capital de Giro",
  "Capital de Giro Rotativo",
  "Capital de Giro Parcelado",
  "Conta Garantida",
  "Cédula de Crédito Bancário (CCB)",
  "Cédula de Crédito Comercial (CCC)",
  "Cédula de Crédito Industrial (CCI)",
  "Desconto de Duplicatas",
  "Antecipação de Recebíveis",
  "Renegociação de Dívida",
  "Confissão de Dívida",
  "Repactuação de Contrato"
]

function App() {
  // --- ESTADOS DO SISTEMA ---
  const [formulario, setFormulario] = useState({
    valor_liberado: '',
    valor_parcela: '',
    qtde_parcelas: '',
    data_contrato: '',
    tipo_contrato: '', 
    numero_contrato: ''
  })
  
  const [resultado, setResultado] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  
  // Estado para abrir/fechar o Modal de Portfólio
  const [mostrarPortfolio, setMostrarPortfolio] = useState(false)

  // --- LÓGICA DO DROPDOWN PERSONALIZADO ---
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false)
  const [sugestoesFiltradas, setSugestoesFiltradas] = useState(OPCOES_CONTRATOS)
  const dropdownRef = useRef(null)

  // Filtra a lista conforme digita
  const handleTipoChange = (e) => {
    const texto = e.target.value
    setFormulario({ ...formulario, tipo_contrato: texto })
    
    const filtrados = OPCOES_CONTRATOS.filter(opcao => 
      opcao.toLowerCase().includes(texto.toLowerCase())
    )
    setSugestoesFiltradas(filtrados)
    setMostrarSugestoes(true)
  }

  // Seleciona item da lista e fecha
  const selecionarTipo = (valor) => {
    setFormulario({ ...formulario, tipo_contrato: valor })
    setMostrarSugestoes(false)
  }

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setMostrarSugestoes(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [dropdownRef])


  // --- SEUS PROJETOS (ATUALIZADO COM PDV APPETITE DETALHADO) ---
  const meusProjetos = [
    {
      titulo: "PDV Appetite (PWA) - App & Web",
      desc: "Sistema de gestão Real-time (Cozinha/Caixa). Login seguro, Sincronização instantânea com Firestore, Leitor de QR Code e funciona Offline (PWA).",
      techs: ["React", "Firebase", "PWA", "Firestore", "Vite"],
      link: "https://github.com/DenisFerreira90/pdv-confeitaria",
      textoBotao: "Ver Código no GitHub ↗"
    },
    {
      titulo: "Controle de Estoque TI",
      desc: "Sistema Desktop robusto para gerenciamento de ativos de TI e inventário interno.",
      techs: ["Python", "Automação", "Desktop", "SQL"],
      link: "https://github.com/DenisFerreira90/EstoqueTI",
      textoBotao: "Acessar Repositório ↗"
    },
    {
      titulo: "Sistema PDV (Python)",
      desc: "Frente de caixa (Point of Sale) clássico desenvolvido em Python para desktop.",
      techs: ["Python", "Tkinter", "Relatórios"],
      link: "https://github.com/DenisFerreira90/PDV-PY",
      textoBotao: "Ver Projeto ↗"
    },
    {
      titulo: "Meu Perfil GitHub",
      desc: "Explore todos os meus repositórios, contribuições e projetos open source.",
      techs: ["Full Stack", "Open Source"],
      link: "https://github.com/DenisFerreira90",
      textoBotao: "Seguir no GitHub ↗"
    }
  ]

  // --- LÓGICA DO FORMULÁRIO ---
  const handleChange = (e) => {
    setFormulario({ ...formulario, [e.target.name]: e.target.value })
  }

  const fazerCalculo = async (e) => {
    e.preventDefault()
    setCarregando(true)
    setErro('')
    try {
      const tipoFinal = formulario.tipo_contrato || 'Contrato de Crédito (Genérico)'
      const payload = {
        valor_liberado: parseFloat(formulario.valor_liberado),
        valor_parcela: parseFloat(formulario.valor_parcela),
        qtde_parcelas: parseInt(formulario.qtde_parcelas),
        data_contrato: formulario.data_contrato,
        tipo_contrato: tipoFinal,
        numero_contrato: formulario.numero_contrato || 'Não informado'
      }
      
      const response = await axios.post('http://127.0.0.1:8000/calcular-revisional', payload)
      setResultado(response.data)
      setTimeout(() => document.getElementById('laudo-final').scrollIntoView({ behavior: 'smooth' }), 200)
    
    } catch (error) {
      setErro('Erro de conexão. Verifique se o backend Python está rodando (uvicorn main:app).')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="app-container">
      
      {/* --- SEÇÃO 1: FORMULÁRIO DE CÁLCULO (Não sai na impressão) --- */}
      <div className="input-section no-print">
        <header className="app-header">
          <h1>Cálculo Revisional Pro</h1>
          <p>Sistema de Perícia Financeira (Método Gauss)</p>
        </header>

        <form onSubmit={fazerCalculo} className="card">
          
          {/* --- DROPDOWN PERSONALIZADO --- */}
          <div className="form-group" ref={dropdownRef} style={{position: 'relative'}}>
            <label>Tipo de Contrato (Selecione ou Digite)</label>
            <input 
              type="text"
              name="tipo_contrato" 
              value={formulario.tipo_contrato} 
              onChange={handleTipoChange}
              onFocus={() => setMostrarSugestoes(true)}
              placeholder="Digite para buscar ou role a lista..." 
              className="input-field"
              autoComplete="off"
              required
            />
            
            {/* Lista Flutuante */}
            {mostrarSugestoes && (
              <ul className="custom-dropdown-list">
                {sugestoesFiltradas.length > 0 ? (
                  sugestoesFiltradas.map((opcao, index) => (
                    <li 
                      key={index} 
                      onClick={() => selecionarTipo(opcao)}
                      className="dropdown-item"
                    >
                      {opcao}
                    </li>
                  ))
                ) : (
                  <li className="dropdown-item disabled">Nenhuma opção encontrada...</li>
                )}
              </ul>
            )}
          </div>

          <div className="form-group">
            <label>Número do Contrato</label>
            <input type="text" name="numero_contrato" onChange={handleChange} placeholder="Opcional" />
          </div>

          <div className="form-group">
            <label>Valor Liberado (Líquido)</label>
            <div className="input-wrapper">
               <span className="currency-symbol">R$</span>
               <input type="number" name="valor_liberado" onChange={handleChange} placeholder="0,00" required />
            </div>
          </div>

          <div className="row">
            <div className="form-group">
              <label>Valor da Parcela</label>
              <div className="input-wrapper">
                <span className="currency-symbol">R$</span>
                <input type="number" step="0.01" name="valor_parcela" onChange={handleChange} placeholder="0,00" required />
              </div>
            </div>
            <div className="form-group">
              <label>Prazo (Meses)</label>
              <input type="number" name="qtde_parcelas" onChange={handleChange} placeholder="Ex: 48" required />
            </div>
          </div>

          <div className="form-group">
            <label>Data do Contrato</label>
            <input type="date" name="data_contrato" onChange={handleChange} required />
          </div>

          <button type="submit" className="btn-primary" disabled={carregando}>
            {carregando ? 'Calculando Perícia...' : 'Gerar Parecer Técnico'}
          </button>
          {erro && <p className="error-message">{erro}</p>}
        </form>
      </div>

      {/* --- SEÇÃO 2: LAUDO TÉCNICO (Visual Papel A4) --- */}
      {resultado && (
        <div id="laudo-final" className="document-paper animate-fade-in">
          
          {/* Aviso Legal */}
          <div className="legal-disclaimer-box">
            <strong>AVISO LEGAL:</strong> Este documento foi gerado de forma automática pelo sistema, conforme as informações preenchidas pelo próprio usuário. 
            Não assumimos qualquer responsabilidade pelo documento no que diz respeito à sua integralidade, correção e atualização. 
            O usuário assume toda e qualquer responsabilidade, de caráter civil e/ou criminal, pela utilização indevida das informações abaixo.
            O presente documento serve como parecer técnico preliminar.
          </div>

          <div className="doc-header">
            <h2>PARECER TÉCNICO FINANCEIRO</h2>
            <span className="doc-meta">
              Contrato nº: {resultado.cabecalho.numero_contrato} • Emissão: {resultado.cabecalho.data_calculo}
            </span>
            <div className="doc-line"></div>
          </div>

          {/* 1. Identificação */}
          <section className="doc-section">
            <h3>1.0 Identificação do Instrumento</h3>
            <p>Abaixo detalhamos as condições financeiras da operação de crédito sob análise, conforme sistema de amortização Price (Juros Compostos):</p>
            <table className="doc-table">
              <tbody>
                <tr>
                  <td>Natureza da Operação:</td>
                  <td><strong>{resultado.cabecalho.tipo_contrato}</strong></td>
                </tr>
                <tr>
                  <td>Valor Financiado (Líquido):</td>
                  <td><strong>R$ {parseFloat(formulario.valor_liberado).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong></td>
                </tr>
                <tr>
                  <td>Taxa Mensal Praticada:</td>
                  <td className="text-danger"><strong>{resultado.banco.taxa_mensal}% a.m.</strong></td>
                </tr>
                <tr>
                  <td>Taxa Anual (Efetiva):</td>
                  <td>{resultado.banco.taxa_anual}% a.a.</td>
                </tr>
                <tr>
                  <td>Prestação Atual:</td>
                  <td>R$ {resultado.banco.parcela.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* 2. Recálculo Gauss */}
          <section className="doc-section">
            <h3>2.0 Recálculo (Método Gauss)</h3>
            <p>Utilizando a taxa média de mercado do Banco Central ({resultado.justo.taxa_mensal}%) e expurgando a capitalização composta (anatocismo) através do Método de Gauss, obtemos:</p>
            
            <div className="gauss-highlight">
              <div className="gauss-item">
                <span>Parcela Recalculada (Justa)</span>
                <strong className="text-success">R$ {resultado.justo.parcela.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
              </div>
              <div className="gauss-item">
                <span>Redução Mensal</span>
                <strong>R$ {resultado.resultado.reducao_mensal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
              </div>
            </div>
          </section>

          {/* 3. Conclusão */}
          <section className="doc-section bg-light">
            <h3>3.0 Conclusão Financeira</h3>
            <p>Com base na série histórica do Bacen adequada para <strong>{resultado.cabecalho.tipo_contrato}</strong>, identificou-se onerosidade excessiva. O valor estimado a ser restituído (Repetição de Indébito) é:</p>
            <div className="final-value">
              R$ {resultado.resultado.valor_recuperar.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
            </div>
          </section>

          {/* 4. Fonte */}
          <section className="doc-section">
            <h3>4.0 Fonte de Referência Oficial</h3>
            <p>A taxa média de mercado foi obtida diretamente da base de dados do Banco Central do Brasil.</p>
            <div className="source-box">
              <strong>Série Utilizada:</strong> {resultado.justo.codigo_serie} (Banco Central)<br/>
              <strong>Link para Auditoria:</strong> <br/>
              <a 
                href={`https://www3.bcb.gov.br/sgspub/consultarvalores/consultarValoresSeries.do?method=consultarSeries&series=${resultado.justo.codigo_serie || 25471}`} 
                target="_blank" 
                rel="noreferrer"
              >
                Clique aqui para validar a taxa no site do Bacen
              </a>
            </div>
          </section>

          {/* Botões do Rodapé (Não sai na impressão) */}
          <div className="doc-footer no-print">
            <button className="btn-print" onClick={() => window.print()}>🖨️ Imprimir PDF</button>
            <button className="btn-whatsapp" onClick={() => window.open(`https://wa.me/?text=Resultado Revisional: R$ ${resultado.resultado.valor_recuperar}`, '_blank')}>📱 Compartilhar</button>
          </div>
          
          {/* Marca d'água na impressão */}
          <div className="watermark print-only">
             Documento gerado eletronicamente via software de cálculo financeiro.<br/>
             Validação dos índices: www.bcb.gov.br
          </div>
        </div>
      )}

      {/* --- RODAPÉ COM LINK PARA O SEU PORTFÓLIO (INTERATIVO) --- */}
      <footer className="dev-footer no-print">
        <p>
          Desenvolvido por{' '}
          <button 
            className="dev-link-btn" 
            onClick={() => setMostrarPortfolio(true)}
            title="Ver outros projetos"
          >
            Denis da Rosa Ferreira
          </button> 
          {' '}• Soluções em Tecnologia
        </p>
      </footer>

      {/* --- MODAL DO PORTFÓLIO (A Janela que Abre) --- */}
      {mostrarPortfolio && (
        <div className="portfolio-modal-backdrop" onClick={() => setMostrarPortfolio(false)}>
          <div className="portfolio-card" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setMostrarPortfolio(false)}>×</button>
            
            <div className="portfolio-header">
              <div className="avatar-circle">DR</div>
              <h2>Denis da Rosa Ferreira</h2>
              <p>Desenvolvedor Full Stack & Especialista em Automação</p>
              <div className="tech-badges">
                <span>React</span><span>Python</span><span>Firebase</span><span>Automação</span>
              </div>
            </div>

            <div className="projects-grid">
              {meusProjetos.map((proj, index) => (
                <div key={index} className="project-item">
                  <h4>{proj.titulo}</h4>
                  <p>{proj.desc}</p>
                  <div className="project-tags">
                    {proj.techs.map(t => <small key={t}>{t}</small>)}
                  </div>
                  <a href={proj.link} target="_blank" rel="noreferrer" className="project-link">
                    {proj.textoBotao}
                  </a>
                </div>
              ))}
            </div>

            <div className="portfolio-footer">
              <button 
                className="btn-whatsapp" 
                onClick={() => window.open('https://wa.me/5551986583348?text=Olá,%20Denis!%20Vi%20seus%20projetos%20no%20GitHub.', '_blank')}
              >
                Falar no WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default App
import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import './App.css'

// --- LISTA COMPLETA DE CONTRATOS ---
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
    numero_contrato: '',
    taxa_manual_bacen: '',   // Taxa de Mercado (Bacen)
    taxa_manual_contrato: '' // NOVA: Taxa do Banco (Contrato)
  })
  
  // Checkboxes para ativar os campos manuais
  const [usarTaxaBacenManual, setUsarTaxaBacenManual] = useState(false)
  const [usarTaxaContratoManual, setUsarTaxaContratoManual] = useState(false)

  const [resultado, setResultado] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  
  // Estados de Interface
  const [mostrarPortfolio, setMostrarPortfolio] = useState(false)
  const [mostrarDica, setMostrarDica] = useState(false)

  // --- LÓGICA DO DROPDOWN ---
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false)
  const [sugestoesFiltradas, setSugestoesFiltradas] = useState(OPCOES_CONTRATOS)
  const dropdownRef = useRef(null)

  const handleTipoChange = (e) => {
    const texto = e.target.value
    setFormulario({ ...formulario, tipo_contrato: texto })
    const filtrados = OPCOES_CONTRATOS.filter(opcao => 
      opcao.toLowerCase().includes(texto.toLowerCase())
    )
    setSugestoesFiltradas(filtrados)
    setMostrarSugestoes(true)
  }

  const selecionarTipo = (valor) => {
    setFormulario({ ...formulario, tipo_contrato: valor })
    setMostrarSugestoes(false)
  }

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setMostrarSugestoes(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [dropdownRef])

  // --- MÁSCARA INTELIGENTE (ESTILO CALCULADORA) ---
  const formatarComoCalculadora = (valorInput) => {
    let v = valorInput.replace(/[^\d,]/g, '');
    const partes = v.split(',');
    if (partes.length > 2) {
      v = partes[0] + ',' + partes.slice(1).join('');
    }
    let [inteiro, decimal] = v.split(',');
    if (inteiro) {
      inteiro = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }
    if (decimal !== undefined) {
      decimal = decimal.substring(0, 2);
      return `${inteiro},${decimal}`;
    }
    return inteiro;
  };

  const handleMoneyChange = (e) => {
    const valorFormatado = formatarComoCalculadora(e.target.value);
    setFormulario({ ...formulario, [e.target.name]: valorFormatado });
  };

  const handleChange = (e) => {
    setFormulario({ ...formulario, [e.target.name]: e.target.value })
  }

  // --- LIMPEZA PARA O BACKEND ---
  const limparValorMoeda = (valorString) => {
    if (!valorString) return 0;
    const limpo = valorString.toString().replace(/\./g, '').replace(',', '.');
    return parseFloat(limpo);
  }

  const formatarMoeda = (valor) => {
    if (!valor && valor !== 0) return "0,00";
    const numero = Number(valor);
    return numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // --- SEUS PROJETOS ---
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

  const fazerCalculo = async (e) => {
    e.preventDefault()
    setCarregando(true)
    setErro('')
    try {
      const tipoFinal = formulario.tipo_contrato || 'Contrato de Crédito (Genérico)'
      
      const payload = {
        valor_liberado: limparValorMoeda(formulario.valor_liberado),
        valor_parcela: limparValorMoeda(formulario.valor_parcela),
        qtde_parcelas: parseInt(formulario.qtde_parcelas),
        data_contrato: formulario.data_contrato,
        tipo_contrato: tipoFinal,
        numero_contrato: formulario.numero_contrato || 'Não informado',
        
        // ENVIO DAS TAXAS MANUAIS (Se ativadas)
        taxa_bacen_manual: usarTaxaBacenManual && formulario.taxa_manual_bacen ? parseFloat(formulario.taxa_manual_bacen.replace(',', '.')) : null,
        taxa_contrato_manual: usarTaxaContratoManual && formulario.taxa_manual_contrato ? parseFloat(formulario.taxa_manual_contrato.replace(',', '.')) : null
      }
      
      const linkAPI = 'https://sistema-calculo-revisional.onrender.com/calcular-revisional'

      const response = await axios.post(linkAPI, payload)
      setResultado(response.data)
      setTimeout(() => document.getElementById('laudo-final').scrollIntoView({ behavior: 'smooth' }), 200)
    
    } catch (error) {
      setErro('Erro de conexão. Verifique se o backend Python está rodando.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="app-container">
      
      {/* --- SEÇÃO 1: FORMULÁRIO --- */}
      <div className="input-section no-print">
        <header className="app-header">
          <h1>Cálculo Revisional Pro</h1>
          <p>Sistema de Perícia Financeira (Método Gauss)</p>
        </header>

        <form onSubmit={fazerCalculo} className="card">
          
          <div style={{textAlign: 'right', marginBottom: '10px'}}>
            <button 
              type="button"
              onClick={() => setMostrarDica(!mostrarDica)}
              style={{
                background: 'transparent', border: 'none', color: '#2997FF', 
                cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold'
              }}
            >
              ❓ Dúvidas no preenchimento?
            </button>
          </div>

          {mostrarDica && (
            <div style={{
              background: 'rgba(41, 151, 255, 0.1)', border: '1px solid #2997FF', 
              borderRadius: '8px', padding: '15px', marginBottom: '20px', fontSize: '0.85rem', color: '#fff'
            }}>
              <strong>Dicas Rápidas:</strong>
              <ul style={{marginTop: '5px', paddingLeft: '20px', lineHeight: '1.5'}}>
                <li>Digite os números direto (Ex: 1000 = 1.000,00).</li>
                <li>Se a taxa do sistema não bater com o papel do banco, use a opção <strong>"Taxa do Contrato Manual"</strong>.</li>
              </ul>
            </div>
          )}

          <div className="form-group" ref={dropdownRef} style={{position: 'relative'}}>
            <label>Tipo de Contrato</label>
            <input 
              type="text"
              name="tipo_contrato" 
              value={formulario.tipo_contrato} 
              onChange={handleTipoChange}
              onFocus={() => setMostrarSugestoes(true)}
              placeholder="Digite para buscar..." 
              className="input-field"
              autoComplete="off"
              required
            />
            {mostrarSugestoes && (
              <ul className="custom-dropdown-list">
                {sugestoesFiltradas.length > 0 ? (
                  sugestoesFiltradas.map((opcao, index) => (
                    <li key={index} onClick={() => selecionarTipo(opcao)} className="dropdown-item">
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
               <input 
                 type="text" 
                 inputMode="decimal"
                 name="valor_liberado"
                 value={formulario.valor_liberado} 
                 onChange={handleMoneyChange} 
                 placeholder="0,00" 
                 required 
               />
            </div>
          </div>

          <div className="row">
            <div className="form-group">
              <label>Valor da Parcela</label>
              <div className="input-wrapper">
                <span className="currency-symbol">R$</span>
                <input 
                  type="text" 
                  inputMode="decimal"
                  name="valor_parcela"
                  value={formulario.valor_parcela} 
                  onChange={handleMoneyChange} 
                  placeholder="0,00" 
                  required 
                />
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

          {/* --- ÁREA DE AJUSTES FINOS (TAXAS MANUAIS) --- */}
          <div style={{marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0'}}>
            <h4 style={{color: '#555', marginTop: 0, fontSize: '0.9rem', marginBottom: '15px'}}>🔧 Ajustes Finos (Opcional)</h4>
            
            {/* 1. Taxa do Contrato (Banco) */}
            <div style={{marginBottom: '10px'}}>
              <div style={{display: 'flex', alignItems: 'center', marginBottom: '5px'}}>
                <input 
                  type="checkbox" 
                  id="checkContrato" 
                  checked={usarTaxaContratoManual}
                  onChange={(e) => setUsarTaxaContratoManual(e.target.checked)}
                  style={{width: '18px', height: '18px', marginRight: '8px'}}
                />
                <label htmlFor="checkContrato" style={{fontSize: '0.85rem', color: '#333', cursor: 'pointer'}}>
                  Tenho a Taxa do Contrato (Banco) exata
                </label>
              </div>
              {usarTaxaContratoManual && (
                <input 
                  type="number" step="0.01" 
                  name="taxa_manual_contrato"
                  value={formulario.taxa_manual_contrato} 
                  onChange={handleChange} 
                  placeholder="% ao mês (Ex: 3.55)" 
                  className="input-field"
                  style={{fontSize: '0.9rem', padding: '8px'}}
                />
              )}
            </div>

            {/* 2. Taxa de Mercado (Bacen) */}
            <div>
              <div style={{display: 'flex', alignItems: 'center', marginBottom: '5px'}}>
                <input 
                  type="checkbox" 
                  id="checkBacen" 
                  checked={usarTaxaBacenManual}
                  onChange={(e) => setUsarTaxaBacenManual(e.target.checked)}
                  style={{width: '18px', height: '18px', marginRight: '8px'}}
                />
                <label htmlFor="checkBacen" style={{fontSize: '0.85rem', color: '#333', cursor: 'pointer'}}>
                  Definir Taxa Média (Bacen) manualmente
                </label>
              </div>
              {usarTaxaBacenManual && (
                <input 
                  type="number" step="0.01" 
                  name="taxa_manual_bacen"
                  value={formulario.taxa_manual_bacen} 
                  onChange={handleChange} 
                  placeholder="% ao mês (Ex: 1.85)" 
                  className="input-field"
                  style={{fontSize: '0.9rem', padding: '8px'}}
                />
              )}
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={carregando} style={{marginTop: '20px'}}>
            {carregando ? 'Calculando Perícia...' : 'Gerar Parecer Técnico'}
          </button>
          {erro && <p className="error-message">{erro}</p>}
        </form>
      </div>

      {/* --- SEÇÃO 2: LAUDO TÉCNICO --- */}
      {resultado && (
        <div id="laudo-final" className="document-paper animate-fade-in">
          
          <div className="legal-disclaimer-box">
            <strong>AVISO LEGAL:</strong> Este documento foi gerado de forma automática pelo sistema. 
            O usuário assume responsabilidade pelas informações inseridas. Documento de caráter preliminar.
          </div>

          <div className="doc-header">
            <h2>PARECER TÉCNICO FINANCEIRO</h2>
            <span className="doc-meta">
              Contrato nº: {resultado.cabecalho.numero_contrato} • Emissão: {resultado.cabecalho.data_calculo}
            </span>
            <div className="doc-line"></div>
          </div>

          <section className="doc-section">
            <h3>1.0 Identificação do Instrumento</h3>
            <p>Abaixo detalhamos as condições financeiras da operação de crédito sob análise:</p>
            <table className="doc-table">
              <tbody>
                <tr>
                  <td>Natureza da Operação:</td>
                  <td><strong>{resultado.cabecalho.tipo_contrato}</strong></td>
                </tr>
                <tr>
                  <td>Valor Financiado (Líquido):</td>
                  <td><strong>R$ {formatarMoeda(limparValorMoeda(formulario.valor_liberado))}</strong></td>
                </tr>
                <tr>
                  <td>Prestação Mensal (Atual):</td>
                  <td>R$ {formatarMoeda(resultado.banco.parcela)}</td>
                </tr>
                <tr>
                  <td>Taxa Mensal (Praticada):</td>
                  <td><strong>{resultado.banco.taxa_mensal}% a.m.</strong></td>
                </tr>
                <tr>
                  <td>Taxa Anual (Efetiva):</td>
                  <td>{resultado.banco.taxa_anual}% a.a.</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="doc-section">
            <h3>2.0 Análise Comparativa e Recálculo</h3>
            <p>Realizou-se o confronto entre a taxa de juros aplicada no contrato e a Taxa Média de Mercado divulgada pelo Banco Central do Brasil para a mesma modalidade e época:</p>
            
            <div className="gauss-highlight" style={{marginBottom: '20px', borderColor: '#ccc', background: '#fff'}}>
              <div className="gauss-item">
                <span style={{color: '#d32f2f', fontWeight: 'bold'}}>Taxa Cobrada (Banco)</span>
                <strong style={{color: '#d32f2f', fontSize: '1.4rem'}}>
                  {resultado.banco.taxa_mensal}% a.m.
                </strong>
              </div>
              <div className="gauss-item" style={{borderLeft: '1px solid #eee'}}>
                <span style={{color: '#2e7d32', fontWeight: 'bold'}}>Taxa Média (Bacen)</span>
                <strong style={{color: '#2e7d32', fontSize: '1.4rem'}}>
                  {resultado.justo.taxa_mensal}% a.m.
                </strong>
              </div>
            </div>

            <p>Com base na taxa justa de mercado e expurgando a capitalização composta (anatocismo) através do Método de Gauss, recalculou-se o valor da prestação:</p>
            
            <div className="gauss-highlight">
              <div className="gauss-item">
                <span>Parcela Recalculada (Justa)</span>
                <strong className="text-success">R$ {formatarMoeda(resultado.justo.parcela)}</strong>
              </div>
              <div className="gauss-item">
                <span>Redução Mensal</span>
                <strong>R$ {formatarMoeda(resultado.resultado.reducao_mensal)}</strong>
              </div>
            </div>
          </section>

          <section className="doc-section bg-light">
            <h3>3.0 Conclusão Financeira</h3>
            <p>Com base na disparidade das taxas apresentadas acima, identificou-se onerosidade excessiva. O valor estimado a ser restituído (Repetição de Indébito) é:</p>
            <div className="final-value">
              R$ {formatarMoeda(resultado.resultado.valor_recuperar)}
            </div>
          </section>

          <section className="doc-section">
            <h3>4.0 Fonte de Referência Oficial</h3>
            <p>A taxa média de mercado foi obtida conforme os parâmetros abaixo:</p>
            <div className="source-box">
              <strong>Série Utilizada:</strong> {resultado.justo.codigo_serie} (Banco Central)<br/>
              <strong>Fonte dos Dados:</strong> {resultado.justo.fonte}<br/>
              <a 
                href={`https://www3.bcb.gov.br/sgspub/consultarvalores/consultarValoresSeries.do?method=consultarSeries&series=${resultado.justo.codigo_serie || 25471}`} 
                target="_blank" 
                rel="noreferrer"
              >
                Clique aqui para validar a taxa no site do Bacen
              </a>
            </div>
          </section>

          <div className="doc-footer no-print">
            <button className="btn-print" onClick={() => window.print()}>🖨️ Imprimir PDF</button>
            <button className="btn-whatsapp" onClick={() => window.open(`https://wa.me/?text=Resultado Revisional: R$ ${formatarMoeda(resultado.resultado.valor_recuperar)}`, '_blank')}>📱 Compartilhar</button>
          </div>
          
          <div className="watermark print-only">
             Documento gerado eletronicamente via software de cálculo financeiro.<br/>
             Validação dos índices: www.bcb.gov.br
          </div>
        </div>
      )}

      {/* --- RODAPÉ --- */}
      <footer className="dev-footer no-print">
        <p>
          Desenvolvido por{' '}
          <button 
            className="dev-link-btn" 
            onClick={() => setMostrarPortfolio(true)}
          >
            Denis da Rosa Ferreira
          </button> 
        </p>
      </footer>

      {/* --- MODAL PORTFÓLIO --- */}
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
                onClick={() => window.open('https://wa.me/5551986583348?text=Olá,%20Denis!%20Vi%20seus%20projetos.', '_blank')}
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
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy_financial as npf
from bcb import sgs
from datetime import datetime, timedelta

app = FastAPI()

# --- CONFIGURAÇÃO DE SEGURANÇA (CORS) ---
# Permite que o Frontend (React) converse com este Backend
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MODELO DE DADOS (O que vem do site) ---
class DadosFinanciamento(BaseModel):
    valor_liberado: float
    valor_parcela: float
    qtde_parcelas: int
    data_contrato: str
    tipo_contrato: str
    numero_contrato: str

# --- INTELIGÊNCIA DE ÍNDICES (CÉREBRO DO SISTEMA) ---
def obter_codigo_serie(tipo_texto):
    """
    Define qual série do Bacen usar baseada no texto do contrato.
    Mapeia a lista gigante do frontend para os códigos oficiais do SGS/Bacen.
    """
    texto = tipo_texto.lower()
    
    # 1. VEÍCULOS (Série 25471 - Aquisição de Veículos PF)
    # Cobre: CDC, Leasing, Alienação, Portabilidade de Veículo
    if any(x in texto for x in ["veículo", "cdc", "leasing", "alienação", "moto", "caminhão"]):
        return 25471 

    # 2. CARTÃO DE CRÉDITO (Série 25477 - Rotativo Total)
    # Cobre: Rotativo, Parcelado, RMC, Benefício
    if any(x in texto for x in ["cartão", "rotativo", "rmc", "benefício"]):
        return 25477 

    # 3. CHEQUE ESPECIAL (Série 25463)
    # Cobre: Cheque Especial, Limite de Conta
    if any(x in texto for x in ["cheque", "conta corrente", "limite"]):
        return 25463 

    # 4. CONSIGNADO INSS (Série 25468 - Beneficiários INSS)
    if "inss" in texto:
        return 25468 

    # 5. CONSIGNADO PÚBLICO (Série 25467 - Setor Público)
    # Cobre: SIAPE, Servidor, Militar
    if any(x in texto for x in ["siape", "servidor", "público", "militar"]):
        return 25467 

    # 6. CONSIGNADO PRIVADO (Série 25469 - Consignado Total)
    # Cobre: CLT Privado e genéricos
    if "consignado" in texto:
        return 25469 

    # 7. EMPRESARIAL / GIRO (Série 20749 - Capital de Giro > 365 dias)
    # Cobre: Giro, Duplicatas, Recebíveis, Conta Garantida, CCI, CCC
    if any(x in texto for x in ["giro", "duplicata", "recebíveis", "industrial", "comercial", "pj", "garantida", "ccc", "cci"]):
        return 20749 
        
    # 8. IMOBILIÁRIO (Série 25471 - Proxy Conservador)
    # O Bacen não tem série diária fácil para SFH/SFI no SGS. 
    # Usamos Veículos (25471) como referência de crédito com garantia real ou Pessoal (25464).
    if any(x in texto for x in ["imóvel", "imobiliário", "casa", "terreno", "sfh", "sfi", "consórcio"]):
        return 25471

    # PADRÃO: CRÉDITO PESSOAL NÃO CONSIGNADO (Série 25464 - Média Geral)
    # Pega: Empréstimo Pessoal, CCB, Renegociação, Confissão, Repactuação
    return 25464

# --- CÁLCULO JUDICIAL (MÉTODO GAUSS) ---
def calcular_parcela_gauss(pv, n, i_decimal):
    """
    Fórmula: PMT = [PV * (1 + i*n)] / [n * (1 + i*(n-1)/2)]
    Remove a capitalização composta (anatocismo).
    """
    try:
        numerador = pv * (1 + (i_decimal * n))
        denominador_termo = (i_decimal * (n - 1) / 2) + 1
        denominador = denominador_termo * n
        return numerador / denominador if denominador != 0 else 0
    except:
        return 0

# --- CONEXÃO COM O BANCO CENTRAL ---
def buscar_taxa_bacen(data_str: str, codigo_serie: int):
    try:
        data_inicial = datetime.strptime(data_str, "%Y-%m-%d")
        try:
            # Busca a taxa na data exata ou nos 5 dias seguintes (caso caia em feriado/fds)
            df = sgs.get({'taxa': codigo_serie}, start=data_inicial, end=data_inicial + timedelta(days=5))
            if not df.empty:
                return float(df['taxa'].iloc[0])
        except:
            pass
        return None 
    except:
        return None

# --- ROTA PRINCIPAL (API) ---
@app.post("/calcular-revisional")
def calcular(dados: DadosFinanciamento):
    # 1. ENGENHARIA REVERSA (Descobrir taxa do Banco)
    try:
        # npf.rate retorna a taxa decimal (ex: 0.02)
        taxa_decimal_banco = npf.rate(dados.qtde_parcelas, -dados.valor_parcela, dados.valor_liberado, 0)
        taxa_banco_perc = float(taxa_decimal_banco * 100) # Converte para % float puro
    except:
        taxa_banco_perc = 0.0
        taxa_decimal_banco = 0.0

    # 2. DEFINIR TAXA JUSTA (BACEN)
    codigo_serie = obter_codigo_serie(dados.tipo_contrato)
    taxa_bacen_perc = buscar_taxa_bacen(dados.data_contrato, codigo_serie)
    
    # Lógica de Fallback (Se o Bacen estiver fora do ar ou data futura)
    if taxa_bacen_perc is None:
        # Estimativas baseadas na média histórica de cada tipo
        if codigo_serie == 25477: taxa_justa_perc = 12.5 # Cartão (Alto)
        elif codigo_serie == 25463: taxa_justa_perc = 8.0 # Cheque Especial (Alto)
        elif codigo_serie == 25468: taxa_justa_perc = 1.6 # INSS (Baixo)
        elif codigo_serie == 25467: taxa_justa_perc = 1.7 # Servidor Público (Baixo)
        elif codigo_serie == 20749: taxa_justa_perc = 2.5 # Giro PJ (Médio)
        else: taxa_justa_perc = 1.9 # Média Geral Pessoal/Veículo
        
        fonte_taxa = f"Estimativa de Mercado (Série {codigo_serie} indisponível na data)"
    else:
        taxa_justa_perc = taxa_bacen_perc
        fonte_taxa = f"Banco Central do Brasil (Série {codigo_serie})"

    # 3. CÁLCULO PELO MÉTODO DE GAUSS
    parcela_gauss = calcular_parcela_gauss(
        dados.valor_liberado, 
        dados.qtde_parcelas, 
        taxa_justa_perc / 100
    )

    # 4. RESULTADOS E ECONOMIA
    total_pago_banco = dados.valor_parcela * dados.qtde_parcelas
    total_pago_justo = parcela_gauss * dados.qtde_parcelas
    excesso = total_pago_banco - total_pago_justo

    # Análise de Abusividade (10% acima da média)
    abusivo = bool(taxa_banco_perc > (taxa_justa_perc * 1.1))

    # Retorna o JSON para o Frontend
    return {
        "cabecalho": {
            "data_calculo": datetime.now().strftime("%d/%m/%Y %H:%M"),
            "metodo": "Sistema de Amortização GAUSS (Juros Simples)",
            "tipo_contrato": dados.tipo_contrato,
            "numero_contrato": dados.numero_contrato
        },
        "banco": {
            "taxa_mensal": f"{taxa_banco_perc:.2f}",
            "taxa_anual": f"{((1 + taxa_decimal_banco)**12 - 1)*100:.2f}", # Juros Compostos
            "parcela": dados.valor_parcela,
            "total": total_pago_banco
        },
        "justo": {
            "taxa_mensal": f"{taxa_justa_perc:.2f}",
            "fonte": fonte_taxa,
            "codigo_serie": codigo_serie,
            "parcela": parcela_gauss,
            "total": total_pago_justo
        },
        "resultado": {
            "abusivo": abusivo,
            "valor_recuperar": excesso if excesso > 0 else 0.00,
            "reducao_mensal": dados.valor_parcela - parcela_gauss
        }
    }

# Rota de teste
@app.get("/")
def home():
    return {"status": "API Revisional Online", "versao": "2.0 Pro"}
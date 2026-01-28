from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy_financial as npf
from bcb import sgs
from datetime import datetime, timedelta
from typing import Optional

app = FastAPI()

# --- CONFIGURAÇÃO DE SEGURANÇA (CORS) ---
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MODELO DE DADOS ---
class DadosFinanciamento(BaseModel):
    valor_liberado: float
    valor_parcela: float
    qtde_parcelas: int
    data_contrato: str
    tipo_contrato: str
    numero_contrato: str
    # Campos Opcionais para Override Manual
    taxa_bacen_manual: Optional[float] = None
    taxa_contrato_manual: Optional[float] = None

# --- FUNÇÃO DE ARREDONDAMENTO (BLINDAGEM) ---
def arredondar(valor):
    """Força matematicamente 2 casas decimais"""
    if valor is None: return 0.00
    return round(float(valor), 2)

# --- INTELIGÊNCIA DE ÍNDICES (SELEÇÃO DE SÉRIE) ---
def obter_codigo_serie(tipo_texto):
    texto = tipo_texto.lower()
    if any(x in texto for x in ["veículo", "cdc", "leasing", "alienação", "moto", "caminhão"]): return 25471 
    if any(x in texto for x in ["cartão", "rotativo", "rmc", "benefício"]): return 25477 
    if any(x in texto for x in ["cheque", "conta corrente", "limite"]): return 25463 
    if "inss" in texto: return 25468 
    if any(x in texto for x in ["siape", "servidor", "público", "militar"]): return 25467 
    if "consignado" in texto: return 25469 
    if any(x in texto for x in ["giro", "duplicata", "recebíveis", "industrial", "comercial", "pj"]): return 20749 
    if any(x in texto for x in ["imóvel", "imobiliário", "casa", "sfh", "sfi"]): return 25471
    return 25464

# --- CÁLCULO JUDICIAL (GAUSS) ---
def calcular_parcela_gauss(pv, n, i_decimal):
    try:
        numerador = pv * (1 + (i_decimal * n))
        denominador_termo = (i_decimal * (n - 1) / 2) + 1
        denominador = denominador_termo * n
        return numerador / denominador if denominador != 0 else 0
    except:
        return 0

# --- BUSCA NO BACEN (SGS) ---
def buscar_taxa_bacen(data_str: str, codigo_serie: int):
    try:
        data_inicial = datetime.strptime(data_str, "%Y-%m-%d")
        try:
            df = sgs.get({'taxa': codigo_serie}, start=data_inicial, end=data_inicial + timedelta(days=5))
            if not df.empty:
                return float(df['taxa'].iloc[0])
        except:
            return None
    except:
        return None
    return None

# --- ROTA PRINCIPAL ---
@app.post("/calcular-revisional")
def calcular(dados: DadosFinanciamento):
    
    # 1. TAXA DO BANCO (CONTRATO)
    # Se o usuário mandou manualmente, usamos ela. Se não, calculamos.
    if dados.taxa_contrato_manual is not None and dados.taxa_contrato_manual > 0:
        taxa_banco_perc = dados.taxa_contrato_manual
        # Recalcula a taxa anual baseada na mensal manual
        taxa_decimal_banco = taxa_banco_perc / 100
    else:
        # Engenharia Reversa (Price/Numpy)
        try:
            taxa_decimal_banco = npf.rate(dados.qtde_parcelas, -dados.valor_parcela, dados.valor_liberado, 0)
            taxa_banco_perc = float(taxa_decimal_banco * 100)
        except:
            taxa_banco_perc = 0.0
            taxa_decimal_banco = 0.0

    # 2. TAXA JUSTA (BACEN/MERCADO)
    codigo_serie = obter_codigo_serie(dados.tipo_contrato)
    
    # Se o usuário mandou manualmente, usamos ela.
    if dados.taxa_bacen_manual is not None and dados.taxa_bacen_manual > 0:
        taxa_justa_perc = dados.taxa_bacen_manual
        fonte_taxa = "Taxa de Mercado Definida Manualmente"
    else:
        # Busca Automática
        taxa_bacen_perc = buscar_taxa_bacen(dados.data_contrato, codigo_serie)
        
        # Lógica de Fallback
        if taxa_bacen_perc is None:
            if codigo_serie == 25477: taxa_justa_perc = 12.5
            elif codigo_serie == 25463: taxa_justa_perc = 8.0
            elif codigo_serie == 25468: taxa_justa_perc = 1.6
            elif codigo_serie == 25467: taxa_justa_perc = 1.7
            elif codigo_serie == 20749: taxa_justa_perc = 2.5
            else: taxa_justa_perc = 1.9 
            fonte_taxa = f"Estimativa de Mercado (Série {codigo_serie})"
        else:
            taxa_justa_perc = taxa_bacen_perc
            fonte_taxa = f"Banco Central do Brasil (Série {codigo_serie})"

    # 3. CÁLCULO GAUSS (Usa a taxa justa definida acima)
    parcela_gauss = calcular_parcela_gauss(
        dados.valor_liberado, 
        dados.qtde_parcelas, 
        taxa_justa_perc / 100
    )
    
    # Trava de segurança
    if parcela_gauss > dados.valor_parcela:
         parcela_gauss = npf.pmt(taxa_justa_perc/100, dados.qtde_parcelas, -dados.valor_liberado)

    # 4. RESULTADOS
    total_pago_banco = dados.valor_parcela * dados.qtde_parcelas
    total_pago_justo = parcela_gauss * dados.qtde_parcelas
    
    reducao_mensal = dados.valor_parcela - parcela_gauss
    excesso_total = reducao_mensal * dados.qtde_parcelas
    
    taxa_anual_banco = ((1 + taxa_decimal_banco)**12 - 1)*100

    return {
        "cabecalho": {
            "data_calculo": datetime.now().strftime("%d/%m/%Y %H:%M"),
            "metodo": "Sistema de Amortização GAUSS",
            "tipo_contrato": dados.tipo_contrato,
            "numero_contrato": dados.numero_contrato
        },
        "banco": {
            "taxa_mensal": arredondar(taxa_banco_perc),
            "taxa_anual": arredondar(taxa_anual_banco),
            "parcela": arredondar(dados.valor_parcela),
            "total": arredondar(total_pago_banco)
        },
        "justo": {
            "taxa_mensal": arredondar(taxa_justa_perc),
            "fonte": fonte_taxa,
            "codigo_serie": str(codigo_serie),
            "parcela": arredondar(parcela_gauss),
            "total": arredondar(total_pago_justo)
        },
        "resultado": {
            "valor_recuperar": arredondar(excesso_total),
            "reducao_mensal": arredondar(reducao_mensal)
        }
    }

@app.get("/")
def home():
    return {"status": "API Revisional Online", "versao": "3.0 Manual Override"}
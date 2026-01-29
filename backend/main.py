from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy_financial as npf
from bcb import sgs
from datetime import datetime, timedelta
from typing import Optional

app = FastAPI()

# --- CONFIGURAÇÃO DE SEGURANÇA (CORS) ---
# Permite que o Frontend (React/Vercel) converse com este Backend
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
    # Campos Opcionais para Override Manual (Ajuste Fino)
    taxa_bacen_manual: Optional[float] = None
    taxa_contrato_manual: Optional[float] = None

# --- FUNÇÃO DE ARREDONDAMENTO (BLINDAGEM) ---
def arredondar(valor):
    """
    Força matematicamente 2 casas decimais.
    Evita dízimas como 17.652,702 -> vira 17.652,70
    """
    if valor is None: return 0.00
    return round(float(valor), 2)

# --- CÉREBRO: MAPEAMENTO DE SÉRIES DO BACEN (SGS) ---
def obter_codigo_serie(tipo_texto):
    """
    Retorna o código da série temporal do Banco Central (SGS)
    baseado no texto selecionado no contrato.
    """
    texto = tipo_texto.lower()
    
    # 1. VEÍCULOS (Série 25471 - Aquisição de veículos - PF)
    # Engloba: CDC, Leasing, Alienação Fiduciária, Motos, Caminhões
    if any(x in texto for x in ["veículo", "cdc", "leasing", "alienação", "moto", "caminhão"]):
        return 25471 

    # 2. CARTÃO DE CRÉDITO - ROTATIVO (Série 25477)
    # Taxas altíssimas. Usado para "Cartão Genérico" como estratégia jurídica.
    if "rotativo" in texto:
        return 25477 

    # 3. CARTÃO DE CRÉDITO - PARCELADO (Série 25478)
    # Taxas menores. Só usa se estiver EXPLÍCITO que é parcelado.
    if "cartão" in texto and "parcelado" in texto:
        return 25478
    
    # 🔥 ESTRATÉGIA AGRESSIVA (CONSUMIDOR):
    # Se for RMC, Benefício ou Cartão Genérico, joga para o ROTATIVO (25477).
    # O banco que lute para provar que era taxa menor.
    if "cartão" in texto or "rmc" in texto or "benefício" in texto:
        return 25477

    # 4. CHEQUE ESPECIAL (Série 25463)
    if any(x in texto for x in ["cheque", "conta corrente", "limite"]):
        return 25463 

    # 5. CONSIGNADO - INSS (Série 25468)
    # Aposentados e Pensionistas (Risco Baixo = Taxa Baixa)
    if "inss" in texto:
        return 25468 

    # 6. CONSIGNADO - SETOR PÚBLICO (Série 25467)
    # Servidores e Militares (Risco Baixo = Taxa Baixa)
    if any(x in texto for x in ["siape", "servidor", "público", "militar", "estadual", "federal"]):
        return 25467 

    # 7. CONSIGNADO - SETOR PRIVADO / CLT (Série 25466)
    # Carteira Assinada (Risco Médio = Taxa um pouco maior que INSS)
    if any(x in texto for x in ["clt", "privado", "empresa"]):
        return 25466 

    # Fallback Consignado (Série 25469 - Total)
    if "consignado" in texto:
        return 25469 

    # 8. PESSOA JURÍDICA / GIRO (Série 20749)
    if any(x in texto for x in ["giro", "duplicata", "recebíveis", "industrial", "comercial", "pj", "garantida", "ccc", "cci"]):
        return 20749 

    # 9. IMOBILIÁRIO (Usa Veículo 25471 como Proxy de Garantia Real)
    if any(x in texto for x in ["imóvel", "imobiliário", "casa", "sfh", "sfi", "terreno"]):
        return 25471

    # PADRÃO: CRÉDITO PESSOAL NÃO CONSIGNADO (Série 25464)
    # Juros Livres (Série mais alta depois do cartão/cheque)
    return 25464

# --- CÁLCULO JUDICIAL (MÉTODO GAUSS) ---
def calcular_parcela_gauss(pv, n, i_decimal):
    """
    Calcula a parcela sem juros sobre juros (Anatocismo).
    Sistema de Amortização Ponderada (Gauss).
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
        # Tenta buscar na data exata. Se for FDS/Feriado, tenta os próximos 5 dias.
        try:
            df = sgs.get({'taxa': codigo_serie}, start=data_inicial, end=data_inicial + timedelta(days=5))
            if not df.empty:
                return float(df['taxa'].iloc[0])
        except:
            return None
    except:
        return None
    return None

# --- ROTA PRINCIPAL (API) ---
@app.post("/calcular-revisional")
def calcular(dados: DadosFinanciamento):
    
    # ---------------------------------------------------------
    # 1. DEFINIR A TAXA DO BANCO (CENÁRIO ATUAL)
    # ---------------------------------------------------------
    # Se o usuário digitou a taxa manualmente (checkbox marcado), usa ela.
    if dados.taxa_contrato_manual is not None and dados.taxa_contrato_manual > 0:
        taxa_banco_perc = dados.taxa_contrato_manual
        # Converte para decimal para cálculos internos (ex: 3.55 -> 0.0355)
        taxa_decimal_banco = taxa_banco_perc / 100
        taxa_anual_banco = ((1 + taxa_decimal_banco)**12 - 1) * 100
    else:
        # Se não, calcula via Engenharia Reversa (Price)
        try:
            taxa_decimal_banco = npf.rate(dados.qtde_parcelas, -dados.valor_parcela, dados.valor_liberado, 0)
            taxa_banco_perc = float(taxa_decimal_banco * 100)
            taxa_anual_banco = ((1 + taxa_decimal_banco)**12 - 1) * 100
        except:
            taxa_banco_perc = 0.0
            taxa_decimal_banco = 0.0
            taxa_anual_banco = 0.0

    # ---------------------------------------------------------
    # 2. DEFINIR A TAXA JUSTA & NOTAS JURÍDICAS
    # ---------------------------------------------------------
    codigo_serie = obter_codigo_serie(dados.tipo_contrato)
    observacao_taxa = "" # Campo para notas técnicas no laudo

    # Lógica para preencher a observação (Segurança Jurídica)
    texto_contrato = dados.tipo_contrato.lower()
    
    # OBS 1: Proxy Imobiliário
    if codigo_serie == 25471 and any(x in texto_contrato for x in ["imóvel", "imobiliário", "casa", "sfh", "sfi"]):
        observacao_taxa = "Taxa imobiliária estimada por proxy de crédito com garantia real (Veículos - SGS 25471), devido à ausência de série diária específica para SFH."

    # OBS 2: Estratégia Cartão Genérico
    elif codigo_serie == 25477 and ("cartão" in texto_contrato or "rmc" in texto_contrato) and "rotativo" not in texto_contrato:
        observacao_taxa = "Adotada a série de Cartão Rotativo (25477) pelo princípio da interpretação mais favorável ao consumidor (art. 47 CDC), salvo prova em contrário de parcelamento com taxas inferiores."

    # Decisão: Taxa Manual ou Busca no Bacen?
    if dados.taxa_bacen_manual is not None and dados.taxa_bacen_manual > 0:
        taxa_justa_perc = dados.taxa_bacen_manual
        fonte_taxa = "Taxa de Mercado Definida Manualmente pelo Usuário"
        observacao_taxa = "Taxa inserida manualmente pelo perito/usuário para ajuste fino."
    else:
        # Busca automática no Bacen
        taxa_bacen_perc = buscar_taxa_bacen(dados.data_contrato, codigo_serie)
        
        # Fallback (Se o Bacen estiver fora do ar ou data futura/muito antiga)
        if taxa_bacen_perc is None:
            # Estimativas médias de segurança
            if codigo_serie == 25477: taxa_justa_perc = 12.5 # Cartão Rotativo (Alto)
            elif codigo_serie == 25478: taxa_justa_perc = 5.5 # Cartão Parcelado
            elif codigo_serie == 25463: taxa_justa_perc = 8.0 # Cheque Especial
            elif codigo_serie == 25468: taxa_justa_perc = 1.6 # INSS
            elif codigo_serie == 25467: taxa_justa_perc = 1.7 # Público
            elif codigo_serie == 25466: taxa_justa_perc = 2.2 # CLT (Um pouco maior que público)
            elif codigo_serie == 20749: taxa_justa_perc = 2.5 # Giro PJ
            elif codigo_serie == 25471: taxa_justa_perc = 1.9 # Veículos
            else: taxa_justa_perc = 3.5 # Pessoal Não Consignado (Alto Risco)
            
            fonte_taxa = f"Estimativa de Mercado (Série {codigo_serie} indisponível na data)"
        else:
            taxa_justa_perc = taxa_bacen_perc
            fonte_taxa = f"Banco Central do Brasil (Série {codigo_serie})"

    # ---------------------------------------------------------
    # 3. RECÁLCULO (MÉTODO DE GAUSS)
    # ---------------------------------------------------------
    parcela_gauss = calcular_parcela_gauss(
        dados.valor_liberado, 
        dados.qtde_parcelas, 
        taxa_justa_perc / 100
    )
    
    # Trava de Segurança: A parcela revisional não pode ser maior que a original.
    if parcela_gauss > dados.valor_parcela:
         # Opção conservadora: Usa a taxa justa mas no sistema Price
         parcela_gauss = npf.pmt(taxa_justa_perc/100, dados.qtde_parcelas, -dados.valor_liberado)
         # Se ainda assim for maior, trava no valor original (não há o que revisar)
         if parcela_gauss > dados.valor_parcela:
             parcela_gauss = dados.valor_parcela

    # ---------------------------------------------------------
    # 4. RESULTADOS (COM ARREDONDAMENTO)
    # ---------------------------------------------------------
    total_pago_banco = dados.valor_parcela * dados.qtde_parcelas
    total_pago_justo = parcela_gauss * dados.qtde_parcelas
    
    reducao_mensal = dados.valor_parcela - parcela_gauss
    excesso_total = reducao_mensal * dados.qtde_parcelas

    return {
        "cabecalho": {
            "data_calculo": datetime.now().strftime("%d/%m/%Y %H:%M"),
            "metodo": "Sistema de Amortização GAUSS (Expurgo da Capitalização)",
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
            "observacao": observacao_taxa,
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
    return {"status": "API Revisional Online", "versao": "7.0 Final Full Features"}
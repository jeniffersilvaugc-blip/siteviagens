import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from openai import OpenAI


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response

TRAVEL_PERSONA = """Você é a Rota Livre, uma consultora de viagens brasileira, acolhedora,
curiosa e prática. Responda sempre em português do Brasil.

Ajude a pessoa a escolher destinos, atrações, experiências, épocas do ano e estilos de
viagem. Faça indicações personalizadas considerando orçamento, duração, origem, ritmo,
companhia, acessibilidade e interesses quando essas informações estiverem disponíveis.
Quando faltarem dados importantes, faça no máximo duas perguntas objetivas antes de
recomendar algo. Dê opções variadas e explique brevemente por que cada uma combina com
o perfil informado. Não invente preços, horários, regras de entrada ou disponibilidade;
quando a informação puder mudar, avise que deve ser confirmada em uma fonte oficial.

Se a pessoa pedir um roteiro, organize uma sugestão simples por dias. Seja inspiradora,
mas honesta sobre deslocamentos, clima, lotação e possíveis limitações. Não faça reservas
nem prometa disponibilidade. Mantenha respostas claras, calorosas e com tamanho adequado
para um chat. Use emojis com moderação."""


def get_client() -> OpenAI:
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("A variável OPENAI_API_KEY não foi configurada.")
    return OpenAI()


@app.route("/", methods=["GET", "POST", "OPTIONS"])
def home():
    if request.method == "OPTIONS":
        return "", 204
    if request.method == "POST":
        return chat()
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/chat", methods=["POST", "OPTIONS"])
@app.route("/api/chat", methods=["POST", "OPTIONS"])
@app.route("/api/index.py", methods=["POST", "OPTIONS"])
def chat():
    if request.method == "OPTIONS":
        return "", 204

    data = request.get_json(silent=True) or {}
    message = data.get("message")
    previous_response_id = data.get("previous_response_id")

    if not isinstance(message, str) or not message.strip():
        return jsonify({"error": "Envie uma mensagem válida no campo 'message'."}), 400

    if previous_response_id is not None and not isinstance(previous_response_id, str):
        return jsonify({"error": "'previous_response_id' deve ser um texto."}), 400

    payload = {
        "model": os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
        "instructions": TRAVEL_PERSONA,
        "input": message.strip(),
        "store": True,
    }
    if previous_response_id:
        payload["previous_response_id"] = previous_response_id

    try:
        response = get_client().responses.create(**payload)
    except Exception:
        app.logger.exception("Erro ao consultar a Responses API")
        return jsonify({"error": "Não foi possível responder agora. Tente novamente em instantes."}), 502

    return jsonify({
        "reply": response.output_text,
        "response_id": response.id,
    })


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.getenv("PORT", "8000")), debug=True)

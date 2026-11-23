const { HttpRequestError } = require("./http-client");

function requireSuccessfulResponse(response) {
  const status = response?.status;
  if (!Number.isInteger(status) || status < 100 || status > 599) {
    throw new HttpRequestError("HTTP_INVALID_BODY");
  }
  if (status !== 200) throw new HttpRequestError("HTTP_STATUS_ERROR", status);
}

function apiErrorMessage(error, fallback) {
  const status = error?.response?.status;
  if (error?.code === "HTTP_RATE_LIMITED" || status === 429) {
    return "O serviço atingiu um limite temporário de consultas. Tente novamente mais tarde.";
  }
  if (error?.code === "HTTP_TIMEOUT") {
    return "O serviço demorou demais para responder. Tente novamente mais tarde.";
  }
  if (error?.code === "HTTP_CANCELLED") {
    return "A consulta ao serviço foi cancelada. Tente novamente.";
  }
  if (status === 400 || status === 422) {
    return "O serviço recusou os dados da consulta. Verifique a entrada e tente novamente.";
  }
  if (status === 401 || status === 403) {
    return "O serviço não permitiu esta consulta. Tente novamente mais tarde.";
  }
  if (
    (status >= 500 && status <= 599) ||
    error?.code === "HTTP_REQUEST_FAILED"
  ) {
    return "O serviço está indisponível no momento. Tente novamente mais tarde.";
  }
  if (error?.code === "HTTP_INVALID_BODY") {
    return "O serviço retornou uma resposta inválida. Tente novamente mais tarde.";
  }
  if (error?.code === "HTTP_RESPONSE_TOO_LARGE") {
    return "A resposta do serviço excedeu o limite permitido. Tente novamente mais tarde.";
  }
  return fallback;
}

module.exports = { requireSuccessfulResponse, apiErrorMessage };

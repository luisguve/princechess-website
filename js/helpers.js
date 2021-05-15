function getUrlParameter(sParam) {
  var sPageURL = window.location.search.substring(1),
    sURLVariables = sPageURL.split('&'),
    sParameterName,
    i;

  for (i = 0; i < sURLVariables.length; i++) {
    sParameterName = sURLVariables[i].split('=');

    if (sParameterName[0] === sParam) {
      return typeof sParameterName[1] === undefined ? true : decodeURIComponent(sParameterName[1]);
    }
  }
  return false;
}

function capitalize(word) {
  return word[0].toUpperCase() + word.slice(1);
}

function getSrvBaseUrl() {
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    return "http://localhost:8000";
  }
  return "https://princechess.herokuapp.com"
}

function getBaseUrl() {
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    return "http://localhost:8080";
  }
  return "https://princechess.herokuapp.com"
}

function getHostname() {
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    return "localhost:8000";
  }
  return "princechess.herokuapp.com"
}

function getSocketUrl() {
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    return "ws://localhost:8000";
  }
  return "wss://princechess.herokuapp.com"
}

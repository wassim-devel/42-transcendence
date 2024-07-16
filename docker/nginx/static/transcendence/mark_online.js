document.addEventListener('DOMContentLoaded', function () {
    const wsScheme = window.location.protocol === "https:" ? "wss" : "ws";
    const webSocket = new WebSocket(wsScheme + '://' + window.location.host + '/ws/online/');

    webSocket.onopen = function (event) {
        console.log('WebSocket opened.');
    };

    webSocket.onclose = function (event) {
        console.log('WebSocket closed.');
    };

    window.onbeforeunload = function () {
        webSocket.close();
    };
});
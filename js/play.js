// NOTE: this example uses the chess.js library:
// https://github.com/jhlywa/chess.js

var conn;

var board = null
var game = new Chess()
var $status = $('#status')
var $fen = $('#fen')
var $pgn = $('#pgn')
var finished = true
var gameId = getUrlParameter("id")
var color = getUrlParameter("color")
var $loader = $('#loader')

var $log = $("#log");

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

if (window["WebSocket"]) {
  conn = new WebSocket(`ws://localhost:8000/game?id=${gameId}`);
  conn.onclose = function (evt) {
    appendLog("Connection closed.");
  };
  conn.onmessage = function (evt) {
    let move = game.move(JSON.parse(evt.data));

    // see if the move is legal
    if (move === null) {
      appendLog(`Error: illegal move: ${evt.data}`);
      return;
    }

    board.position(game.fen());
    updateStatus();
  };
} else {
  alert("Your browser does not support WebSockets.");
}

function appendLog(content) {
  let item = document.createElement("b");
  item.innerHTML = content;
  log.appendChild(item);
}

$('#3min').click(() => {
  if (!finished) {
    alert("You are in the middle of a game")
    return
  }
  play(3);
});

$('#5min').click(() => {
  if (!finished) {
    alert("You are in the middle of a game")
    return
  }
  play(5);
});

$('#10min').click(() => {
  if (!finished) {
    alert("You are in the middle of a game")
    return
  }
  play(10);
});

function play(min) {
  $loader.addClass("loader");
  const url = `http://localhost:8000/play?clock=${min}`;
  fetch(url, {'credentials': 'include'})
  .then(response => {
    if (!response.ok) {
      $loader.removeClass("loader");
      appendLog("Could not reach server");
      return
    }
    return response.json();
  })
  .then(res => {
    if (!res.roomId) {
      $loader.removeClass("loader");
      appendLog("Could not find an opponent");
      return;
    }
    // redirect to play room
    document.location.href = `/play.html?id=${res.roomId}&color=${res.color}`;
  });
}

function onDragStart (source, piece, position, orientation) {
  // do not pick up pieces if the game is over
  if (game.game_over()) return false

  // only pick up pieces for the side to move
  if ((game.turn() === 'w' && color === 'black') ||
      (game.turn() === 'b' && color === 'white')) {
    return false
  }
  if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
      (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
    return false
  }
}

function onDrop (source, target) {
  // see if the move is legal
  var move = game.move({
    from: source,
    to: target,
    promotion: 'q' // NOTE: always promote to a queen for example simplicity
  })

  // illegal move
  if (move === null) return 'snapback'

  if (!conn) {
    return 'snapback';
  }

  conn.send(JSON.stringify({
    from: source,
    to: target,
    color: move.color,
    promotion: 'q'
  }));

  updateStatus()
}

// update the board position after the piece snap
// for castling, en passant, pawn promotion
function onSnapEnd () {
  board.position(game.fen())
}

function updateStatus () {
  var status = ''

  var moveColor = 'White'
  if (game.turn() === 'b') {
    moveColor = 'Black'
  }

  // checkmate?
  if (game.in_checkmate()) {
    status = 'Game over, ' + moveColor + ' is in checkmate.'
  }

  // stalemate?
  else if (game.in_stalemate()) {
    status = 'Game over, ' + moveColor + ' is in stalemate.'
  }

  // prince promoted?
  else if (game.prince_promoted()) {
    moveColor = game.turn() === 'b' ? 'White' : 'Black'
    status = 'Game over, ' + moveColor + ' promoted his prince.'
  }

  // draw?
  else if (game.in_draw()) {
    status = 'Game over, drawn position'
  }

  // game still on
  else {
    status = moveColor + ' to move'

    // check?
    if (game.in_check()) {
      status += ', ' + moveColor + ' is in check'
    }
  }

  $status.html(status)
  // $fen.html(game.fen())
  var pgnResult = game.pgn()
      .split(/\d+\./)
      .slice(1)
      .map((steps, idx) => {
        let history = steps.trim().split(/\s/)
        let colspan = 1
        if (history.length === 1) {
          colspan = 2
        }
        history = history.reduce((res, step, idx, arr) => {
          return res + `<td colspan="${colspan}">${step}</td>`
        }, "")
        return `
          <tr>
            <th scope="row" class="w-25">${idx + 1}</th>
            ${history}
          </tr>`
      })
      .reduce((res, steps) => { return res + steps }, `
        <table class="table table-striped">
        <thead>
          <tr>
            <th scope="col" class="w-25"></th>
            <th scope="col">White</th>
            <th scope="col">Black</th>
          </tr>
        </thead>
        <tbody>`) + "</tbody>"
  $pgn.html(pgnResult)
}

var config = {
  draggable: true,
  position: 'start',
  orientation: color,
  onDrop,
  onSnapEnd,
  onDragStart
}
board = Chessboard('board', config)

updateStatus()
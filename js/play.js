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
var clock = getUrlParameter("clock")
var opp = getUrlParameter("opp")
var $loader = $('#loader')
var $oppclock = $('.opp-clock')
var $myclock = $('.my-clock')
var $oppsec = $('.oppsec')
var $oppmin = $('.oppmin')
  for (var i = $oppmin.length - 1; i >= 0; i--) {
    $oppmin[i].innerHTML = clock
  }
var $mysec = $('.mysec')
var $mymin = $('.mymin')
  for (var i = $mymin.length - 1; i >= 0; i--) {
    $mymin[i].innerHTML = clock
  }
var sec
var min
var myInterval
var oppInterval

var $log = $("#log")

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

if (window["WebSocket"]) {
  conn = new WebSocket(`ws://localhost:8000/game?id=${gameId}&clock=${clock}`);
  conn.onerror = evt => {
    // appendLog("Could not connect.");
  };
  conn.onclose = evt => {
    switch (evt.code) {
    case 1006:
      appendLog("Game not found");
      break;
    case 1001:
      appendLog(`Game over: opponent left. ${capitalize(color)} wins`);
      break;
    case 1000:
      appendLog("Connection closed.");
      break;
    }
  };
  conn.onmessage = evt => {
    let data = JSON.parse(evt.data);
    let move = game.move(data);

    // see if the move is legal
    if (move === null) {
      // if not, see if the message received has to do with opponent's time left
      if (data.oppClock) {
        // if both players have done their first move (history >= 2),
        // reset opponent's clock
        if (game.history().length >= 2) {
          $oppsec.innerHTML = Math.floor( (data.oppClock/1000) % 60 );
          $oppmin.innerHTML = Math.floor( (data.oppClock/1000*60) % 60 );
        }
        return;
      }
      appendLog(`Error: illegal move: ${evt.data}`);
      return;
    }
    // received a move:
    // if both players have done their first move (history >= 2),
    // stop opponent's clock and start my clock
    if (game.history().length >= 2) {
      startMyClock();
      // then reset opponent's clock
      $oppsec.innerHTML = Math.floor( (data.oppClock/1000) % 60 );
      $oppmin.innerHTML = Math.floor( (data.oppClock/1000*60) % 60 );
    }
    // finally, update the board.
    board.position(game.fen());
    updateStatus();
  };
} else {
  alert("Your browser does not support WebSockets.");
}

fetch("http://localhost:8000/username", {credentials: "include"})
.then(res => res.text())
.then(username => {
  username = username ? username : "You"
  let containers = document.querySelectorAll(".my-username")
  for (var i = containers.length - 1; i >= 0; i--) {
    containers[i].innerHTML = username
  }
});

let oppUsername = document.querySelectorAll(".opp-username")
for (var i = oppUsername.length - 1; i >= 0; i--) {
  oppUsername[i].innerHTML = opp
}

function appendLog(content) {
  let item = document.createElement("b");
  item.innerHTML = `${content}<br >`;
  log.appendChild(item);
}

function emptyLog() {
  while (log.firstChild) {
    log.firstChild.remove()
  }
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
  emptyLog();
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

  // if both players have done their first move (history >= 2),
  // stop my clock and start opponent's clock
  if (game.history().length >= 2) {
    startOppClock();
  }

  if (game.game_over()) {
    conn.close(1000, "draw");
  }

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

function ticker(playerSec, playerMin, playerClock) {
  return () => {
    sec = playerSec[0].innerHTML;
    min = playerMin[0].innerHTML;

    if (sec >= 11) {
      sec--;
      for (var i = playerSec.length - 1; i >= 0; i--) {
        playerSec[i].textContent = sec;
      }
    } else if (sec >= 1) {
      sec--;
      for (var i = playerSec.length - 1; i >= 0; i--) {
        playerSec[i].textContent = '0' + sec;
      }
    } else if (sec == 0 && min >= 1){
      sec = 59;
      min--;
      for (var i = playerSec.length - 1; i >= 0; i--) {
        playerSec[i].textContent = sec;
      }
      for (var i = playerMin.length - 1; i >= 0; i--) {
        playerMin[i].textContent = min;
      }
    } else {
      for (var i = playerClock.length - 1; i >= 0; i--) {
        playerClock[i].style.background = 'red';
      }
    }
  }
}

// stop opponent's clock and start my clock
function startMyClock() {
  clearInterval(oppInterval);
  myInterval = setInterval(ticker($mysec, $mymin, $myclock), 1000);
}
// stop my clock and start opponent's clock
function startOppClock() {
  clearInterval(myInterval);
  oppInterval = setInterval(ticker($oppsec, $oppmin, $oppclock), 1000);
}

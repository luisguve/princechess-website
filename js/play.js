var conn;

var board = null
var game = new Chess()
var moves = 0
var $status = $('#status')
var $fen = $('#fen')
var $pgn = $('#pgn')
var finished = false
var oppReady = false
var connReady = false
var gameId = getUrlParameter("id")
var color = getUrlParameter("color")
var oppColor = (color === "white") ? "black" : "white";
var clock = getUrlParameter("clock")
var opp = getUrlParameter("opp")
var me
var $oppclock = $('.opp-clock')
var $myclock = $('.my-clock')
var $oppsec = $('.oppsec')
var $oppmin = $('.oppmin')
  $oppmin.html(clock)
var $mysec = $('.mysec')
var $mymin = $('.mymin')
  $mymin.html(clock)
var sec
var min
var myInterval
var oppInterval

var $log = $("#log")
var $loader = $("#loader")

var drawOffer = $(".draw-offer");
var acceptDrawButtons = $("button.accept-draw");
var declineDrawButtons = $("button.decline-draw");

var drawButtons = $("button.draw")
var drawDisabled = true
var sentDrawOffer = false
var resignButtons = $("button.resign")
var resignDisabled = true

var rematchButtons = $("button.rematch")
var rematchDisabled = true

var rematchOffer = $(".rematch-offer")
var acceptRematchButtons = $("button.accept-rematch")
var declineRematchButtons = $("button.decline-rematch")

const srvBaseUrl = getSrvBaseUrl()
const socketUrl = getSocketUrl()

function updateClock(mins, secs, ms) {
  let minutes = Math.floor( (ms/1000/60) % 60 );
  let seconds = Math.floor( (ms/1000) % 60 );
  if (seconds == 0) {
    seconds = "00";
  }
  if (seconds > 1 && seconds < 10) {
    seconds = "0" + seconds;
  }
  mins.html(minutes);
  secs.html(seconds);
}

if (window["WebSocket"]) {
  const url = `${socketUrl}/game?id=${gameId}&clock=${clock}`;
  conn = new ReconnectingWebSocket(url);
  conn.onerror = evt => {
    updateStatus({msg:"Game not found"});
    finishRoom();
  };
  conn.onopen = evt => {
    clearLog();
    $loader.removeClass("loader");
    connReady = true;
  }
  conn.onclose = evt => {
    switch (evt.code) {
    case 1006:
      appendLog("Game not found");
      finishRoom()
      break;
    case 1001:
      clearLog();
      if (finished) {
        appendLog(`Opponent left the room.`);
      } else {
        appendLog(`Game over: opponent left. ${capitalize(color)} wins`);
      }
      finishRoom();
      break;
    case 1000:
      appendLog("Connection lost. Trying to reconnect");
      $loader.addClass("loader");
      break;
    }
  };
  conn.onmessage = evt => {
    let data = JSON.parse(evt.data);

    if (data.chat) {
      let messages = data.chat.split('\n');
      for (let i = 0; i < messages.length; i++) {
          let item = document.createElement("p");
          let from = document.createElement("b");
          from.innerText = data.from + ": ";
          item.appendChild(from);
          item.appendChild(document.createTextNode(messages[i]));
          appendChat(item);
      }
      return
    }

    if (data.pgn) {
      // Update the engine
      game.load_pgn(data.pgn);
      // Update the board
      board.position(game.fen());
      updateStatus();
      return;
    }

    if (data.waitingOpp) {
      if (finished) {
        if (connReady) {
          let signalFinishRoom = JSON.stringify({
            finishRoom: true
          });
          conn.send(signalFinishRoom);
          finishRoom();
        }
        clearLog();
        updateStatus({msg: "Opponent left the room"});
        return
      }
      $loader.addClass("loader");
      appendLog("Waiting for opponent");
      return;
    }

    if (data.oppGone) {
      clearLog();
      let data = {};
      if (moves > 2) {
        data.msg = `Game over: opponent left. ${capitalize(color)} wins`;
      } else {
        data.msg = "Opponent left the room"
      }
      updateStatus(data);
      finishRoom();
      return;
    }

    if (data.oppReady) {
      oppReady = true;
      clearLog();
      $loader.removeClass("loader");
      return;
    }

    if (data.oppResigned) {
      finishGame();
      updateStatus({resigned: oppColor});
      return;
    }

    if (data.oppAcceptedDraw) {
      finishGame();
      updateStatus({draw: true});
      return;
    }

    if (data.drawOffer) {
      drawOffer.removeClass("d-none");
      return;
    }

    if (data.rematchOffer) {
      rematchOffer.removeClass("d-none");
      return;
    }

    if (data.oppAcceptedRematch) {
      resetGame();
      return;
    }

    let move = game.move(data.move);

    // see if the move is legal
    if (move === null) {
      // if not, see if the message received has to do with opponent's time left
      if (data.oppClock) {
        // if both players have done their first move,
        // reset opponent's clock
        if (game.history().length >= 2) {
          updateClock($oppmin, $oppsec, data.oppClock);
          updateClock($mymin, $mysec, data.clock);
        }
        return;
      }
      // if not, see if one of the player ran out of time
      if (data.OOT) {
        let clockOOT = {};
        switch (data.OOT) {
        case "MY_CLOCK":
          clockOOT.colorOOT = color;
          printOOT($mysec, $mymin, $myclock);
          break;
        case "OPP_CLOCK":
          clockOOT.colorOOT = oppColor;
          printOOT($oppsec, $oppmin, $oppclock);
          break;
        default:
          appendLog("Invalid flag:" + data.OOT);
          return;
        }
        finishGame();
        updateStatus(clockOOT);
        return
      }

      appendLog(`Error: illegal move: ${evt.data}`);
      return;
    }
    // received a move:
    moves++;
    // if both players have done their first move,
    // stop opponent's clock and start my clock
    if (game.history().length >= 2) {
      startMyClock();
      // then reset opponent's clock
      updateClock($oppmin, $oppsec, data.oppClock);
      updateClock($mymin, $mysec, data.clock);
    }
    // finally, update the board.
    board.position(game.fen());
    updateStatus();
  };
} else {
  alert("Your browser does not support WebSockets.");
}

fetch(`${srvBaseUrl}/username`, {credentials: "include"})
.then(res => res.text())
.then(username => {
  username = username ? username : "You";
  me = username;
  $(".my-username").html(username);
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

function clearLog() {
  while (log.firstChild) {
    log.firstChild.remove()
  }
}

$('#1min').click(() => {
  if (!finished) {
    alert("You are in the middle of a game")
    return
  }
  play(1);
});

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
  clearLog();
  const url = `${srvBaseUrl}/play?clock=${min}`;
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
    document.location.href = `/play.html?id=${res.roomId}&color=${res.color}&clock=${min}&opp=${res.opp}`;
  });
}

function onDragStart (source, piece, position, orientation) {
  // do not pick up pieces if the game is over or one of the clocks reached zero
  if (finished || clockInZero()) return false

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

  if (!connReady) {
    return 'snapback';
  }

  conn.send(JSON.stringify({
    move: {
      from: source,
      to: target,
      color: move.color,
      promotion: 'q',
      pgn: game.pgn()
    }
  }));

  moves++;

  // if both players have done their first move,
  // stop my clock and start opponent's clock
  if (game.history().length >= 2) {
    startOppClock();
  }

  updateStatus()
}

// update the board position after the piece snap
// for castling, en passant, pawn promotion
function onSnapEnd () {
  board.position(game.fen())
}

function updateStatus(data) {
  // if both players have done their first move,
  // enable draw and resign buttons
  if (moves == 2) {
    if (drawDisabled && !sentDrawOffer && !finished) {
      drawButtons.removeClass("disabled");
      drawDisabled = false;
    }
    if (resignDisabled && !finished) {
      resignButtons.removeClass("disabled");
      resignDisabled = false;
    }
  }

  let status = ''

  let moveColor = 'White'
  if (game.turn() === 'b') {
    moveColor = 'Black'
  }
  // any data?
  if (data) {
    // out of time?
    if (data.colorOOT) {
      let winner = (data.colorOOT === "white") ? "black" : "white";
      status = `${capitalize(data.colorOOT)} ran out of time. ${capitalize(winner)} wins.`;
    }
    // opponent resigned?
    else if (data.resigned) {
      let winner = (data.resigned === "white") ? "black" : "white";
      status = `${capitalize(data.resigned)} resigned. ${capitalize(winner)} wins.`;
    }
    // draw offer accepted?
    else if (data.draw) {
      status = 'Game over, draw offer accepted'
    }
    // custom message?
    else if (data.msg) {
      status = data.msg
    }
  }
  // checkmate?
  else if (game.in_checkmate()) {
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

  if (game.game_over()) {
    finishGame(true);
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

function ticker(playerSec, playerMin, playerClock, interval) {
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
        clearInterval(interval);
      }
    }
  }
}

// stop opponent's clock and start my clock
function startMyClock() {
  clearInterval(oppInterval);
  myInterval = setInterval(ticker($mysec, $mymin, $myclock, myInterval), 1000);
}
// stop my clock and start opponent's clock
function startOppClock() {
  clearInterval(myInterval);
  oppInterval = setInterval(ticker($oppsec, $oppmin, $oppclock, oppInterval), 1000);
}
function stopClocks() {
  clearInterval(myInterval);
  clearInterval(oppInterval);
}
function printOOT(playerSec, playerMin, playerClock) {
  playerSec.html("00");
  playerMin.html("0");
  playerClock.css("background", "red");
}
function clockInZero() {
  return ($mysec.html() == "00" && $mymin.html() == "0") ||
    ($oppsec.html() == "00" && $oppmin.html() == "0")
}

/* Chat */

var chatMsg = $("#chat-msg");
var chatLog = $("#chat-log");

$("#chat-form").submit(e => {
  e.preventDefault();
  if (!chatMsg.val()) {
    return;
  }
  if (!connReady) {
    let item = document.createElement("p");
    let from = document.createElement("b");
    from.innerText = me + ": ";
    item.appendChild(from);
    item.appendChild(document.createTextNode(chatMsg.val()));
    appendChat(item);
    chatMsg.val("");
    return;
  }
  let msg = JSON.stringify({
    chat: chatMsg.val(),
  });
  conn.send(msg);
  chatMsg.val("");
});

function appendChat(item) {
  var doScroll = chatLog.scrollTop > chatLog.scrollHeight - chatLog.clientHeight - 1;
  chatLog.append(item);
  if (doScroll) {
    chatLog.scrollTop = chatLog.scrollHeight - chatLog.clientHeight;
  }
}

// actions

drawButtons.click(e => {
  if (drawDisabled) return;
  let action = JSON.stringify({
    drawOffer: true
  });
  conn.send(action);
  drawButtons.addClass("disabled")
  drawDisabled = true
  sentDrawOffer = true
});

acceptDrawButtons.click(e => {
  let action = JSON.stringify({
    acceptDraw: true
  });
  conn.send(action);
  finishGame(true);
  updateStatus({draw: true});
});

declineDrawButtons.click(e => {
  drawOffer.addClass("d-none");
});

resignButtons.click(e => {
  if (resignDisabled) return;
  let action = JSON.stringify({
    resign: true
  });
  conn.send(action);
  finishGame(true);
  updateStatus({resigned: color});
});

rematchButtons.click(e => {
  if (rematchDisabled || !finished) return;
  let action = JSON.stringify({
    rematchOffer: true
  });
  conn.send(action);
  rematchButtons.addClass("disabled");
  rematchDisabled = true;
});

acceptRematchButtons.click(e => {
  let action = JSON.stringify({
    acceptRematch: true
  });
  conn.send(action);
  resetGame();
  rematchOffer.addClass("d-none");
});

declineRematchButtons.click(e => {
  rematchOffer.addClass("d-none");
});

function finishGame(signal) {
  $loader.removeClass("loader");
  stopClocks();
  if (signal && connReady) {
    let signalGameOver = JSON.stringify({
      gameOver: true
    });
    conn.send(signalGameOver);
  }
  finished = true;
  drawDisabled = true
  drawButtons.addClass("disabled")
  resignDisabled = true
  resignButtons.addClass("disabled")
  drawOffer.addClass("d-none")
  rematchDisabled = false
  rematchButtons.removeClass("disabled")
}

// Similar to finishGame, but rematch buttons are disabled
// and the connection is closed
function finishRoom() {
  $loader.removeClass("loader");
  stopClocks();
  finished = true;
  drawDisabled = true
  drawButtons.addClass("disabled")
  resignDisabled = true
  resignButtons.addClass("disabled")
  drawOffer.addClass("d-none")
  rematchDisabled = true
  rematchButtons.addClass("disabled")
  conn.close()
  connReady = false;
}

function resetGame() {
  clearLog();
  $oppclock.css("background", "none");
  $myclock.css("background", "none");
  finished = false;
  sentDrawOffer = false;
  rematchDisabled = true;
  rematchButtons.addClass("disabled");
  moves = 0;
  color = color == "white" ? "black" : "white";
  board.start();
  board.flip();
  game.reset();
  $oppmin.html(clock);
  $oppsec.html("00");
  $mymin.html(clock);
  $mysec.html("00");
  updateStatus();

  let newUrl = `/play.html?id=${gameId}&color=${color}&clock=${clock}&opp=${opp}`;

  window.history.replaceState(null, null, newUrl);
}

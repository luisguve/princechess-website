// NOTE: this example uses the chess.js library:
// https://github.com/jhlywa/chess.js

var board = null
var game = new Chess()
var $status = $('#status')
var $fen = $('#fen')
var $pgn = $('#pgn')
var $start = $('#start')
var $strength = $('#strength')
var level = 3
var $loader = $('#loader')

var $log = $("#log");

$start.click(restart);

$strength.html(`Strength (${level})`);

$('#level1').click(() => {
  level = 1;
  $strength.html('Strength (1)');
  restart()
  return true;
});
$('#level2').click(() => {
  level = 2;
  $strength.html('Strength (2)');
  restart()
  return true;
});

$('#level3').click(() => {
  level = 3;
  $strength.html('Strength (3)');
  restart()
  return true;
});

$('#1min').click(() => {
  play(1);
});
$('#3min').click(() => {
  play(3);
});

$('#5min').click(() => {
  play(5);
});

$('#10min').click(() => {
  play(10);
});

function play(min) {
  $loader.addClass("loader")
  emptyLog()
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
      return
    }
    // redirect to play room
    document.location.href = `/play.html?id=${res.roomId}&color=${res.color}&clock=${min}&opp=${res.opp}`;
  });
}

function appendLog(content) {
  let item = document.createElement("b");
  item.innerHTML = content;
  log.appendChild(item);
}

function emptyLog() {
  while (log.firstChild) {
    log.firstChild.remove()
  }
}

function restart() {
  game.reset();
  globalSum = 0;
  board.position(game.fen());
  updateStatus();
  if ($start.html() === 'Restart')
    $start.html("Play");
  return true
}

function onDragStart (source, piece, position, orientation) {
  // do not pick up pieces if the game is over
  if (game.game_over()) return false

  // only pick up pieces for the side to move
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

  globalSum = evaluateBoard(move, globalSum, 'b');

  if (!game.game_over()) {
    // Make the best move for black
    window.setTimeout(() => {
      let response = makeBestMove(game, 'b');
      game.move(response);
      board.position(game.fen());
      updateStatus();
    }, 250)
  }

  updateStatus()
  if ($start.html() === 'Play')
    $start.html("Restart");
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
        <table class="table table-striped mb-0">
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
  onDrop,
  onSnapEnd,
  onDragStart
}
board = Chessboard('board', config)

updateStatus()

fetch("http://localhost:8000/username", {credentials: "include"})
.then(res => res.text())
.then(username => {
  if (username) {
    let content = `<h3 class="username p-2">Hello, <em><b>${username}</b></em></h3`
    document.querySelector("#username-placeholder").innerHTML = content
  }
})

$('#username-form').submit(e => {
  e.preventDefault()
  let username = $("#username").val()
  if (!username) {
    return
  }

  let data = new FormData(document.querySelector("#username-form"))

  // Make the request
  let url = 'http://localhost:8000/username';
  let fetchOptions = {
    method: 'POST',
    credentials: "include",
    body: data
  };

  fetch(url, fetchOptions)
  .then(res => {
    if (!res.ok) {
      appendLog("Could not reach server");
    }
  })
  .then(() => {
    let content = `<h3 class="bg-primary">Hello, ${username}</h3`
    document.querySelector("#username-placeholder").innerHTML = content;
  });
})

function disableInviteButtons() {
  $("#invite1min").addClass("disabled")
  $("#invite3min").addClass("disabled")
  $("#invite5min").addClass("disabled")
  $("#invite10min").addClass("disabled")
}

function enableInviteButtons() {
  $("#invite1min").removeClass("disabled")
  $("#invite3min").removeClass("disabled")
  $("#invite5min").removeClass("disabled")
  $("#invite10min").removeClass("disabled")
}

$('#invite1min').click(() => {
  if ($("#invite1min").hasClass("disabled")) return
  disableInviteButtons()
  invite(1);
});
$('#invite3min').click(() => {
  if ($("#invite3min").hasClass("disabled")) return
  disableInviteButtons()
  invite(3);
});
$('#invite5min').click(() => {
  if ($("#invite5min").hasClass("disabled")) return
  disableInviteButtons()
  invite(5);
});
$('#invite10min').click(() => {
  if ($("#invite10min").hasClass("disabled")) return
  disableInviteButtons()
  invite(10);
});
function invite(min) {
  $loader.addClass("loader")
  emptyLog()
  const url = `http://localhost:8000/invite?clock=${min}`;
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
    enableInviteButtons()
    if (!res.inviteId) {
      $loader.removeClass("loader");
      appendLog("Apologies, something went wrong");
      return
    }
    // redirect to wait room
    document.location.href = `http://localhost:8080/wait.html?id=${res.inviteId}&clock=${min}`;
  });
}

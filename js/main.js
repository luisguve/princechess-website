// NOTE: this example uses the chess.js library:
// https://github.com/jhlywa/chess.js

var board = null
var game = new Chess()
var $status = $('#status')
var $fen = $('#fen')
var $pgn = $('#pgn')
var $start = $('#start')
var $strength = $('#strength')

$start.click(restart)

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
        let history = steps.trim().split(/\s/).reduce((res, step) => {
          return res + `<td>${step}</td>`
        }, "")
        return `
          <tr>
            <th scope="row">${idx + 1}</th>
            ${history}
          </tr>`
      })
      .reduce((res, steps) => { return res + steps }, `<table class="table">
        <thead>
          <tr>
            <th scope="col"></th>
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
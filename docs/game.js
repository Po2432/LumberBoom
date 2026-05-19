const BOARD_SIZE = 10;
let board = [];
let score = 0;
let gameMode = 'classic';
let selectedPieceIndex = null;
let currentPieces = [];
let moves = 0;

const SHAPES = [
    [[1]], [[1,1]], [[1],[1]], [[1,1,1]], [[1],[1],[1]], [[1,1,1,1]], [[1],[1],[1],[1]],
    [[1,1],[1,1]], [[1,1,1],[1,1,1],[1,1,1]],
    [[1,1],[1,0]], [[1,1],[0,1]], [[1,0],[1,1]], [[0,1],[1,1]],
    [[1,1,1],[1,0,0],[1,0,0]], [[1,1,1],[0,0,1],[0,0,1]],
    [[1,0,0],[1,0,0],[1,1,1]], [[0,0,1],[0,0,1],[1,1,1]]
];

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

function startGame(mode) {
    gameMode = mode;
    score = 0;
    moves = 0;
    document.getElementById('score').innerText = score;
    showScreen('game-screen');
    initBoard();
    generatePieces();
}

function initBoard() {
    board = Array.from({length: BOARD_SIZE}, () => Array(BOARD_SIZE).fill(0));
    drawBoard();
}

function drawBoard() {
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';
    for(let y=0; y<BOARD_SIZE; y++) {
        for(let x=0; x<BOARD_SIZE; x++) {
            let cell = document.createElement('div');
            cell.classList.add('cell');
            if (board[y][x] === 1) cell.classList.add('filled');
            else if (typeof board[y][x] === 'object') {
                cell.classList.add('bomb');
                cell.innerText = board[y][x].timer;
            }
            cell.onclick = () => placePiece(x, y);
            boardEl.appendChild(cell);
        }
    }
}

function generatePieces() {
    currentPieces = [];
    for(let i=0; i<3; i++) currentPieces.push(SHAPES[Math.floor(Math.random() * SHAPES.length)]);
    drawTray();
    checkGameOver();
}

function drawTray() {
    const trayEl = document.getElementById('tray');
    trayEl.innerHTML = '';
    currentPieces.forEach((piece, index) => {
        let pieceEl = document.createElement('div');
        pieceEl.classList.add('tray-piece');
        if (index === selectedPieceIndex) pieceEl.classList.add('selected');
        
        if(piece) {
            pieceEl.style.gridTemplateColumns = `repeat(${piece[0].length}, 20px)`;
            pieceEl.onclick = () => { selectedPieceIndex = index; drawTray(); };
            
            for(let r=0; r<piece.length; r++) {
                for(let c=0; c<piece[0].length; c++) {
                    let cell = document.createElement('div');
                    cell.className = 'tray-cell ' + (piece[r][c] ? 'filled' : 'empty');
                    pieceEl.appendChild(cell);
                }
            }
        }
        trayEl.appendChild(pieceEl);
    });
}

function placePiece(startX, startY) {
    if (selectedPieceIndex === null || !currentPieces[selectedPieceIndex]) return;
    let piece = currentPieces[selectedPieceIndex];
    
    if (canPlace(piece, startX, startY)) {
        for(let r=0; r<piece.length; r++) {
            for(let c=0; c<piece[0].length; c++) {
                if(piece[r][c]) board[startY + r][startX + c] = 1;
            }
        }
        currentPieces[selectedPieceIndex] = null;
        selectedPieceIndex = null;
        moves++;
        processTurn();
    }
}

function canPlace(piece, startX, startY) {
    for(let r=0; r<piece.length; r++) {
        for(let c=0; c<piece[0].length; c++) {
            if(piece[r][c]) {
                if (startY + r >= BOARD_SIZE || startX + c >= BOARD_SIZE) return false;
                if (board[startY + r][startX + c] !== 0) return false;
            }
        }
    }
    return true;
}

function processTurn() {
    let bombExploded = false;
    for(let y=0; y<BOARD_SIZE; y++) {
        for(let x=0; x<BOARD_SIZE; x++) {
            if (typeof board[y][x] === 'object') {
                board[y][x].timer--;
                if (board[y][x].timer <= 0) bombExploded = true;
            }
        }
    }

    if (bombExploded) return endGame();

    checkLines();

    if (gameMode === 'bomb' && moves % 5 === 0) spawnBomb();

    drawBoard();
    drawTray();

    if (currentPieces.every(p => p === null)) generatePieces();
    else checkGameOver();
}

function spawnBomb() {
    let emptyCells = [];
    for(let y=0; y<BOARD_SIZE; y++) {
        for(let x=0; x<BOARD_SIZE; x++) {
            if (board[y][x] === 0) emptyCells.push({x, y});
        }
    }
    if (emptyCells.length > 0) {
        let spot = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        board[spot.y][spot.x] = { timer: 9 };
    }
}

function checkLines() {
    let rowsToClear = [], colsToClear = [];

    for(let y=0; y<BOARD_SIZE; y++) {
        let full = true;
        for(let x=0; x<BOARD_SIZE; x++) if(board[y][x] === 0) full = false;
        if (full) rowsToClear.push(y);
    }
    for(let x=0; x<BOARD_SIZE; x++) {
        let full = true;
        for(let y=0; y<BOARD_SIZE; y++) if(board[y][x] === 0) full = false;
        if (full) colsToClear.push(x);
    }

    rowsToClear.forEach(y => { for(let x=0; x<BOARD_SIZE; x++) board[y][x] = 0; });
    colsToClear.forEach(x => { for(let y=0; y<BOARD_SIZE; y++) board[y][x] = 0; });

    let linesCleared = rowsToClear.length + colsToClear.length;
    if (linesCleared > 0) {
        score += (linesCleared * 10) + (linesCleared > 1 ? 10 : 0);
        document.getElementById('score').innerText = score;
    }
}

function checkGameOver() {
    let canMove = false;
    currentPieces.forEach(piece => {
        if (!piece) return;
        for(let y=0; y<BOARD_SIZE; y++) {
            for(let x=0; x<BOARD_SIZE; x++) if (canPlace(piece, x, y)) canMove = true;
        }
    });
    if (!canMove) endGame();
}

function endGame() {
    showScreen('game-over-screen');
    document.getElementById('final-score').innerText = score;
}

const BOARD_SIZE = 10;
let board = [];
let score = 0;
let highScores = { classic: 0, bomb: 0 };
let gameMode = 'classic';
let currentPieces = [];
let moves = 0;

// Drag variables
let dragState = null;

const SHAPES = [
    [[1]], [[1,1]], [[1],[1]], [[1,1,1]], [[1],[1],[1]], [[1,1,1,1]], [[1],[1],[1],[1]],
    [[1,1],[1,1]], [[1,1,1],[1,1,1],[1,1,1]],
    [[1,1],[1,0]], [[1,1],[0,1]], [[1,0],[1,1]], [[0,1],[1,1]],
    [[1,1,1],[1,0,0],[1,0,0]], [[1,1,1],[0,0,1],[0,0,1]],
    [[1,0,0],[1,0,0],[1,1,1]], [[0,0,1],[0,0,1],[1,1,1]]
];

// Initialize on load
window.onload = () => {
    highScores.classic = parseInt(localStorage.getItem('lumberboom_hs_classic')) || 0;
    highScores.bomb = parseInt(localStorage.getItem('lumberboom_hs_bomb')) || 0;
    
    // Global Drag Listeners
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
};

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

function startGame(mode) {
    gameMode = mode;
    score = 0;
    moves = 0;
    document.getElementById('score').innerText = score;
    document.getElementById('high-score').innerText = highScores[gameMode];
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
            cell.id = `cell-${x}-${y}`;
            cell.classList.add('cell');
            if (board[y][x] === 1) cell.classList.add('filled');
            else if (typeof board[y][x] === 'object') {
                cell.classList.add('bomb');
                cell.innerText = board[y][x].timer;
            }
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
        
        if(piece) {
            pieceEl.style.gridTemplateColumns = `repeat(${piece[0].length}, 1fr)`;
            
            // Allow pointer dragging
            pieceEl.addEventListener('pointerdown', (e) => onPointerDown(e, index));
            
            for(let r=0; r<piece.length; r++) {
                for(let c=0; c<piece[0].length; c++) {
                    let cell = document.createElement('div');
                    cell.className = 'tray-cell ' + (piece[r][c] ? 'filled' : 'empty');
                    // Store coordinates for accurate grab-offset tracking
                    cell.dataset.r = r;
                    cell.dataset.c = c;
                    pieceEl.appendChild(cell);
                }
            }
        }
        trayEl.appendChild(pieceEl);
    });
}

// ---- DRAG AND DROP ENGINE ----

function onPointerDown(e, pieceIndex) {
    if (dragState) return;
    let piece = currentPieces[pieceIndex];
    if (!piece) return;
    
    // Find where the user grabbed the piece
    let grabR = Math.floor(piece.length / 2);
    let grabC = Math.floor(piece[0].length / 2);
    if (e.target.dataset.r !== undefined) {
        grabR = parseInt(e.target.dataset.r);
        grabC = parseInt(e.target.dataset.c);
    }

    // Hide original piece slightly
    let originalEl = document.getElementById('tray').children[pieceIndex];
    originalEl.classList.add('dragging');

    // Calculate ghost block sizes based on current actual board size
    let boardRect = document.getElementById('board').getBoundingClientRect();
    let cellW = (boardRect.width - 20) / BOARD_SIZE; // Rough padding math

    // Create ghost piece
    let ghost = document.createElement('div');
    ghost.classList.add('ghost-piece');
    ghost.style.gridTemplateColumns = `repeat(${piece[0].length}, ${cellW}px)`;
    
    for(let r=0; r<piece.length; r++) {
        for(let c=0; c<piece[0].length; c++) {
            let gCell = document.createElement('div');
            gCell.className = 'ghost-cell ' + (piece[r][c] ? 'filled' : 'empty');
            gCell.style.width = `${cellW}px`;
            gCell.style.height = `${cellW}px`;
            ghost.appendChild(gCell);
        }
    }
    document.body.appendChild(ghost);

    dragState = {
        index: pieceIndex,
        piece: piece,
        grabR: grabR,
        grabC: grabC,
        ghost: ghost,
        originalEl: originalEl,
        validX: null,
        validY: null
    };
    
    moveGhost(e.clientX, e.clientY);
}

function onPointerMove(e) {
    if (!dragState) return;
    
    // Move Ghost Piece (offsetting Y slightly up so finger doesn't hide it)
    let touchY = e.clientY - 60;
    moveGhost(e.clientX, touchY);

    // Calculate grid hovering
    let boardRect = document.getElementById('board').getBoundingClientRect();
    let cellW = boardRect.width / BOARD_SIZE;
    let cellH = boardRect.height / BOARD_SIZE;

    if (e.clientX >= boardRect.left && e.clientX <= boardRect.right &&
        touchY >= boardRect.top && touchY <= boardRect.bottom) {
        
        let hoverX = Math.floor((e.clientX - boardRect.left) / cellW);
        let hoverY = Math.floor((touchY - boardRect.top) / cellH);

        let startX = hoverX - dragState.grabC;
        let startY = hoverY - dragState.grabR;

        clearHighlights();
        if (canPlace(dragState.piece, startX, startY)) {
            dragState.validX = startX;
            dragState.validY = startY;
            drawHighlights(dragState.piece, startX, startY);
        } else {
            dragState.validX = null;
            dragState.validY = null;
        }
    } else {
        clearHighlights();
        dragState.validX = null;
        dragState.validY = null;
    }
}

function moveGhost(x, y) {
    if (dragState && dragState.ghost) {
        dragState.ghost.style.left = x + 'px';
        dragState.ghost.style.top = y + 'px';
    }
}

function onPointerUp(e) {
    if (!dragState) return;

    // Remove ghost visuals
    dragState.ghost.remove();
    dragState.originalEl.classList.remove('dragging');
    clearHighlights();

    // Valid Drop?
    if (dragState.validX !== null && dragState.validY !== null) {
        placePiece(dragState.index, dragState.validX, dragState.validY);
    }
    dragState = null;
}

// ---- PLACEMENT & GAME LOGIC ----

function canPlace(piece, startX, startY) {
    for(let r=0; r<piece.length; r++) {
        for(let c=0; c<piece[0].length; c++) {
            if(piece[r][c]) {
                if (startY + r < 0 || startY + r >= BOARD_SIZE || startX + c < 0 || startX + c >= BOARD_SIZE) return false;
                if (board[startY + r][startX + c] !== 0) return false;
            }
        }
    }
    return true;
}

function clearHighlights() {
    document.querySelectorAll('.cell.highlight').forEach(el => el.classList.remove('highlight'));
}

function drawHighlights(piece, startX, startY) {
    for(let r=0; r<piece.length; r++) {
        for(let c=0; c<piece[0].length; c++) {
            if (piece[r][c]) {
                let cellEl = document.getElementById(`cell-${startX + c}-${startY + r}`);
                if (cellEl) cellEl.classList.add('highlight');
            }
        }
    }
}

function placePiece(index, startX, startY) {
    let piece = currentPieces[index];
    
    // Place physically on logic board
    for(let r=0; r<piece.length; r++) {
        for(let c=0; c<piece[0].length; c++) {
            if(piece[r][c]) board[startY + r][startX + c] = 1;
        }
    }
    
    currentPieces[index] = null;
    moves++;
    
    updateScore(piece.flat().filter(x => x===1).length); // points for placement
    drawBoard();
    drawTray();

    processTurn();
}

function processTurn() {
    // Check Bomb Explosions
    let bombExploded = false;
    for(let y=0; y<BOARD_SIZE; y++) {
        for(let x=0; x<BOARD_SIZE; x++) {
            if (typeof board[y][x] === 'object') {
                board[y][x].timer--;
                if (board[y][x].timer <= 0) bombExploded = true;
            }
        }
    }

    if (bombExploded) {
        drawBoard(); // Show zero
        setTimeout(() => endGame(), 300);
        return;
    }

    // Check Lines & Animate
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

    if (rowsToClear.length > 0 || colsToClear.length > 0) {
        // Step 1: Animation Class Trigger
        rowsToClear.forEach(y => { for(let x=0; x<BOARD_SIZE; x++) document.getElementById(`cell-${x}-${y}`).classList.add('clearing'); });
        colsToClear.forEach(x => { for(let y=0; y<BOARD_SIZE; y++) document.getElementById(`cell-${x}-${y}`).classList.add('clearing'); });

        // Step 2: Timeout for logical clearing
        setTimeout(() => {
            rowsToClear.forEach(y => { for(let x=0; x<BOARD_SIZE; x++) board[y][x] = 0; });
            colsToClear.forEach(x => { for(let y=0; y<BOARD_SIZE; y++) board[y][x] = 0; });
            
            let linesCleared = rowsToClear.length + colsToClear.length;
            updateScore((linesCleared * 10) + (linesCleared > 1 ? 10 : 0));
            
            finishTurnEvents();
        }, 300); // 300ms matches CSS animation
    } else {
        finishTurnEvents();
    }
}

function finishTurnEvents() {
    if (gameMode === 'bomb' && moves % 5 === 0) spawnBomb();
    
    drawBoard();
    
    if (currentPieces.every(p => p === null)) generatePieces();
    else checkGameOver();
}

function spawnBomb() {
    let emptyCells = [];
    for(let y=0; y<BOARD_SIZE; y++) {
        for(let x=0; x<BOARD_SIZE; x++) if (board[y][x] === 0) emptyCells.push({x, y});
    }
    if (emptyCells.length > 0) {
        let spot = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        board[spot.y][spot.x] = { timer: 9 };
    }
}

function updateScore(points) {
    score += points;
    document.getElementById('score').innerText = score;
    
    if (score > highScores[gameMode]) {
        highScores[gameMode] = score;
        document.getElementById('high-score').innerText = highScores[gameMode];
        localStorage.setItem(`lumberboom_hs_${gameMode}`, highScores[gameMode]);
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
    document.getElementById('final-best-score').innerText = highScores[gameMode];
}

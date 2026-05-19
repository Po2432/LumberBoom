const BOARD_SIZE = 10;
let board = [];
let score = 0;
let highScores = { classic: 0, bomb: 0 };
let gameMode = 'classic';
let currentPieces = [];
let moves = 0;

// Drag / Tap variables
let dragState = null;
let pointerDownPos = { x: 0, y: 0 };
let pointerDownTime = 0;

const SHAPES = [
    [[1]], [[1,1]], [[1],[1]], [[1,1,1]], [[1],[1],[1]], [[1,1,1,1]], [[1],[1],[1],[1]],
    [[1,1],[1,1]], [[1,1,1],[1,1,1],[1,1,1]],
    [[1,1],[1,0]], [[1,1],[0,1]], [[1,0],[1,1]], [[0,1],[1,1]],
    [[1,1,1],[1,0,0],[1,0,0]], [[1,1,1],[0,0,1],[0,0,1]],
    [[1,0,0],[1,0,0],[1,1,1]], [[0,0,1],[0,0,1],[1,1,1]]
];

window.onload = () => {
    // Load high scores
    highScores.classic = parseInt(localStorage.getItem('lumberboom_hs_classic')) || 0;
    highScores.bomb = parseInt(localStorage.getItem('lumberboom_hs_bomb')) || 0;
    
    // Global Listeners
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    // Simulated Loading Screen
    setTimeout(() => {
        showScreen('menu-screen');
    }, 1500);
};

// --- ROTATION LOGIC ---
function rotateMatrix(matrix) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    let rotated = Array.from({ length: cols }, () => Array(rows).fill(0));
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            rotated[c][rows - 1 - r] = matrix[r][c];
        }
    }
    return rotated;
}

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
            pieceEl.addEventListener('pointerdown', (e) => onPointerDown(e, index));
            
            for(let r=0; r<piece.length; r++) {
                for(let c=0; c<piece[0].length; c++) {
                    let cell = document.createElement('div');
                    cell.className = 'tray-cell ' + (piece[r][c] ? 'filled' : 'empty');
                    cell.dataset.r = r;
                    cell.dataset.c = c;
                    pieceEl.appendChild(cell);
                }
            }
        }
        trayEl.appendChild(pieceEl);
    });
}

// ---- TAP TO ROTATE & DRAG TO PLACE ----

function onPointerDown(e, pieceIndex) {
    if (dragState) return;
    let piece = currentPieces[pieceIndex];
    if (!piece) return;

    pointerDownPos = { x: e.clientX, y: e.clientY };
    pointerDownTime = Date.now();

    // Determine Grab Offset (which block cell finger is on)
    let grabR = Math.floor(piece.length / 2);
    let grabC = Math.floor(piece[0].length / 2);
    if (e.target.dataset.r !== undefined) {
        grabR = parseInt(e.target.dataset.r);
        grabC = parseInt(e.target.dataset.c);
    }

    let originalEl = document.getElementById('tray').children[pieceIndex];
    
    dragState = {
        index: pieceIndex,
        piece: piece,
        grabR: grabR,
        grabC: grabC,
        originalEl: originalEl,
        ghost: null, // Created on Move
        isDragging: false,
        validX: null,
        validY: null
    };
}

function onPointerMove(e) {
    if (!dragState) return;
    
    // Prevent default scrolling when dragging
    if (dragState.isDragging) e.preventDefault();

    // Check if it's a drag or just a tap
    let dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
    if (!dragState.isDragging && dist > 10) {
        dragState.isDragging = true;
        dragState.originalEl.classList.add('dragging');
        createGhost();
    }

    if (dragState.isDragging && dragState.ghost) {
        // We lift the target Y up by ~3 board cells so it sits visibly above the finger
        let boardRect = document.getElementById('board').getBoundingClientRect();
        let cellW = (boardRect.width - 20) / BOARD_SIZE;
        
        let targetX = e.clientX;
        let targetY = e.clientY - (cellW * 3); 

        // Position the ghost visually. 
        // We shift it so the cell the user grabbed (`grabC`, `grabR`) is exactly at targetX, targetY.
        dragState.ghost.style.left = (targetX - (dragState.grabC * cellW) - (cellW/2)) + 'px';
        dragState.ghost.style.top = (targetY - (dragState.grabR * cellW) - (cellW/2)) + 'px';

        // Calculate board hover coordinates
        if (targetX >= boardRect.left && targetX <= boardRect.right &&
            targetY >= boardRect.top && targetY <= boardRect.bottom) {
            
            let hoverC = Math.floor((targetX - boardRect.left) / cellW);
            let hoverR = Math.floor((targetY - boardRect.top) / cellW);

            let startX = hoverC - dragState.grabC;
            let startY = hoverR - dragState.grabR;

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
}

function createGhost() {
    let boardRect = document.getElementById('board').getBoundingClientRect();
    let cellW = (boardRect.width - 20) / BOARD_SIZE; // Exact board cell width

    let ghost = document.createElement('div');
    ghost.classList.add('ghost-piece');
    ghost.style.gridTemplateColumns = `repeat(${dragState.piece[0].length}, ${cellW}px)`;
    
    for(let r=0; r<dragState.piece.length; r++) {
        for(let c=0; c<dragState.piece[0].length; c++) {
            let gCell = document.createElement('div');
            gCell.className = 'ghost-cell ' + (dragState.piece[r][c] ? 'filled' : 'empty');
            gCell.style.width = `${cellW}px`;
            gCell.style.height = `${cellW}px`;
            ghost.appendChild(gCell);
        }
    }
    document.body.appendChild(ghost);
    dragState.ghost = ghost;
}

function onPointerUp(e) {
    if (!dragState) return;

    if (!dragState.isDragging) {
        // It was a TAP -> Rotate
        let timePassed = Date.now() - pointerDownTime;
        if (timePassed < 300) {
            currentPieces[dragState.index] = rotateMatrix(dragState.piece);
            drawTray();
            checkGameOver();
        }
    } else {
        // It was a DRAG -> Attempt Place
        if (dragState.ghost) dragState.ghost.remove();
        dragState.originalEl.classList.remove('dragging');
        clearHighlights();

        if (dragState.validX !== null && dragState.validY !== null) {
            placePiece(dragState.index, dragState.validX, dragState.validY);
        }
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
    
    for(let r=0; r<piece.length; r++) {
        for(let c=0; c<piece[0].length; c++) {
            if(piece[r][c]) board[startY + r][startX + c] = 1;
        }
    }
    
    currentPieces[index] = null;
    moves++;
    updateScore(piece.flat().filter(x => x===1).length); 
    drawBoard();
    drawTray();
    processTurn();
}

function processTurn() {
    let bombExploded = false;
    let bombEl = null;

    for(let y=0; y<BOARD_SIZE; y++) {
        for(let x=0; x<BOARD_SIZE; x++) {
            if (typeof board[y][x] === 'object') {
                board[y][x].timer--;
                if (board[y][x].timer <= 0) {
                    bombExploded = true;
                    bombEl = document.getElementById(`cell-${x}-${y}`);
                }
            }
        }
    }

    if (bombExploded) {
        drawBoard(); 
        // Trigger Explosion Effects
        document.body.classList.add('shake');
        if (bombEl) bombEl.classList.add('exploding');
        
        setTimeout(() => {
            document.body.classList.remove('shake');
            endGame();
        }, 1000); // Wait for explosion animation
        return;
    }

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
        rowsToClear.forEach(y => { for(let x=0; x<BOARD_SIZE; x++) document.getElementById(`cell-${x}-${y}`).classList.add('clearing'); });
        colsToClear.forEach(x => { for(let y=0; y<BOARD_SIZE; y++) document.getElementById(`cell-${x}-${y}`).classList.add('clearing'); });

        setTimeout(() => {
            rowsToClear.forEach(y => { for(let x=0; x<BOARD_SIZE; x++) board[y][x] = 0; });
            colsToClear.forEach(x => { for(let y=0; y<BOARD_SIZE; y++) board[y][x] = 0; });
            
            let linesCleared = rowsToClear.length + colsToClear.length;
            updateScore((linesCleared * 10) + (linesCleared > 1 ? 10 : 0));
            finishTurnEvents();
        }, 300);
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
        // Test all rotations
        let p = piece;
        for(let r=0; r<4; r++) {
            for(let y=0; y<BOARD_SIZE; y++) {
                for(let x=0; x<BOARD_SIZE; x++) {
                    if (canPlace(p, x, y)) canMove = true;
                }
            }
            p = rotateMatrix(p);
        }
    });
    if (!canMove) endGame();
}

function endGame() {
    showScreen('game-over-screen');
    document.getElementById('final-score').innerText = score;
    document.getElementById('final-best-score').innerText = highScores[gameMode];
}

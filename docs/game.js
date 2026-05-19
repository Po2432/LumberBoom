const BOARD_SIZE = 10;
let board = [];
let score = 0;
let highScores = { classic: 0, bomb: 0 };
let gameMode = 'classic';
let currentPieces = [];
let moves = 0;

// Bonuses
let bonuses = { remove: 1, move: 1, reroll: 1, hint: 1, defuse: 1 };
let defuseCooldown = 0;
let activeBonus = null; // 'remove', 'move_pickup', 'move_place', 'defuse'
let moveBuffer = null; // Stores block being moved

// Drag variables
let dragState = null;
let pointerDownPos = { x: 0, y: 0 };
let pointerDownTime = 0;
let boardRect = null;
let cellW = 0;

const SHAPES = [
    [[1]], [[1,1]], [[1],[1]], [[1,1,1]], [[1],[1],[1]], [[1,1,1,1]], [[1],[1],[1],[1]],
    [[1,1],[1,1]], [[1,1,1],[1,1,1],[1,1,1]],
    [[1,1],[1,0]], [[1,1],[0,1]], [[1,0],[1,1]], [[0,1],[1,1]],
    [[1,1,1],[1,0,0],[1,0,0]], [[1,1,1],[0,0,1],[0,0,1]],
    [[1,0,0],[1,0,0],[1,1,1]], [[0,0,1],[0,0,1],[1,1,1]]
];

window.onload = () => {
    highScores.classic = parseInt(localStorage.getItem('lumberboom_hs_classic')) || 0;
    highScores.bomb = parseInt(localStorage.getItem('lumberboom_hs_bomb')) || 0;
    
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    
    setTimeout(() => showScreen('menu-screen'), 1200);
};

function rotateMatrix(matrix) {
    const rows = matrix.length, cols = matrix[0].length;
    let rotated = Array.from({ length: cols }, () => Array(rows).fill(0));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) rotated[c][rows - 1 - r] = matrix[r][c];
    return rotated;
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

function startGame(mode) {
    gameMode = mode;
    score = 0; moves = 0;
    bonuses = { remove: 1, move: 1, reroll: 1, hint: 1, defuse: 1 };
    defuseCooldown = 0;
    activeBonus = null;
    
    document.getElementById('score').innerText = score;
    document.getElementById('high-score').innerText = highScores[gameMode];
    
    document.querySelectorAll('.bomb-only').forEach(el => el.style.display = mode === 'bomb' ? 'flex' : 'none');
    updateBonusUI();
    
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
            
            // Intercept taps for bonuses
            cell.onpointerdown = (e) => handleBoardTap(e, x, y);
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
                    cell.dataset.r = r; cell.dataset.c = c;
                    pieceEl.appendChild(cell);
                }
            }
        }
        trayEl.appendChild(pieceEl);
    });
}

// ---- SMOOTH HARDWARE DRAGGING ----

function onPointerDown(e, pieceIndex) {
    if (activeBonus || dragState) return; // Disable drag if using a bonus
    let piece = currentPieces[pieceIndex];
    if (!piece) return;

    pointerDownPos = { x: e.clientX, y: e.clientY };
    pointerDownTime = Date.now();

    let grabR = Math.floor(piece.length / 2);
    let grabC = Math.floor(piece[0].length / 2);
    if (e.target.dataset.r !== undefined) {
        grabR = parseInt(e.target.dataset.r);
        grabC = parseInt(e.target.dataset.c);
    }
    
    boardRect = document.getElementById('board').getBoundingClientRect();
    cellW = (boardRect.width - 20) / BOARD_SIZE;

    dragState = {
        index: pieceIndex, piece: piece,
        grabR: grabR, grabC: grabC,
        originalEl: document.getElementById('tray').children[pieceIndex],
        ghost: null, isDragging: false, validX: null, validY: null
    };
}

function onPointerMove(e) {
    if (!dragState) return;
    
    if (dragState.isDragging) e.preventDefault();

    let dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
    if (!dragState.isDragging && dist > 10) {
        dragState.isDragging = true;
        dragState.originalEl.classList.add('dragging');
        createGhost();
    }

    if (dragState.isDragging && dragState.ghost) {
        // Position ghost slightly above finger
        let targetX = e.clientX;
        let targetY = e.clientY - (cellW * 3); 
        
        let tx = targetX - (dragState.grabC * cellW) - (cellW/2);
        let ty = targetY - (dragState.grabR * cellW) - (cellW/2);
        
        // GPU Accelerated translate
        dragState.ghost.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;

        // Calculate Highlight overlap
        if (targetX >= boardRect.left && targetX <= boardRect.right &&
            targetY >= boardRect.top && targetY <= boardRect.bottom) {
            
            let hoverC = Math.floor((targetX - boardRect.left) / cellW);
            let hoverR = Math.floor((targetY - boardRect.top) / cellW);
            let startX = hoverC - dragState.grabC;
            let startY = hoverR - dragState.grabR;

            clearHighlights();
            if (canPlace(dragState.piece, startX, startY)) {
                dragState.validX = startX; dragState.validY = startY;
                drawHighlights(dragState.piece, startX, startY);
            } else {
                dragState.validX = null; dragState.validY = null;
            }
        } else {
            clearHighlights();
            dragState.validX = null; dragState.validY = null;
        }
    }
}

function createGhost() {
    let ghost = document.createElement('div');
    ghost.classList.add('ghost-piece');
    ghost.style.gridTemplateColumns = `repeat(${dragState.piece[0].length}, ${cellW}px)`;
    
    for(let r=0; r<dragState.piece.length; r++) {
        for(let c=0; c<dragState.piece[0].length; c++) {
            let gCell = document.createElement('div');
            gCell.className = 'ghost-cell ' + (dragState.piece[r][c] ? 'filled' : 'empty');
            gCell.style.width = `${cellW}px`; gCell.style.height = `${cellW}px`;
            ghost.appendChild(gCell);
        }
    }
    document.body.appendChild(ghost);
    dragState.ghost = ghost;
}

function onPointerUp(e) {
    if (!dragState) return;

    if (!dragState.isDragging) {
        if (Date.now() - pointerDownTime < 300) {
            currentPieces[dragState.index] = rotateMatrix(dragState.piece);
            drawTray(); checkGameOver();
        }
    } else {
        if (dragState.ghost) dragState.ghost.remove();
        dragState.originalEl.classList.remove('dragging');
        clearHighlights();

        if (dragState.validX !== null && dragState.validY !== null) {
            placePiece(dragState.index, dragState.validX, dragState.validY);
        }
    }
    dragState = null;
}

// ---- GAME LOGIC ----

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

function clearHighlights() { document.querySelectorAll('.cell.highlight, .cell.hint-highlight').forEach(el => {el.classList.remove('highlight'); el.classList.remove('hint-highlight');}); }

function drawHighlights(piece, startX, startY, typeClass = 'highlight') {
    for(let r=0; r<piece.length; r++) {
        for(let c=0; c<piece[0].length; c++) {
            if (piece[r][c]) {
                let cellEl = document.getElementById(`cell-${startX + c}-${startY + r}`);
                if (cellEl) cellEl.classList.add(typeClass);
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
    updateScore(piece.flat().filter(x => x===1).length); 
    drawTray();
    advanceTurn();
}

function advanceTurn(skipPieceGen = false) {
    moves++;
    if (defuseCooldown > 0) {
        defuseCooldown--;
        if (defuseCooldown === 0) bonuses.defuse = 1;
    }
    updateBonusUI();
    
    let bombExploded = false;
    let bombEl = null;

    for(let y=0; y<BOARD_SIZE; y++) {
        for(let x=0; x<BOARD_SIZE; x++) {
            if (typeof board[y][x] === 'object') {
                board[y][x].timer--;
                if (board[y][x].timer <= 0) { bombExploded = true; bombEl = document.getElementById(`cell-${x}-${y}`); }
            }
        }
    }

    if (bombExploded) {
        drawBoard(); 
        document.body.classList.add('shake');
        if (bombEl) bombEl.classList.add('exploding');
        setTimeout(() => { document.body.classList.remove('shake'); endGame(); }, 1000); 
        return;
    }

    let rowsToClear = [], colsToClear = [];
    for(let y=0; y<BOARD_SIZE; y++) {
        let full = true; for(let x=0; x<BOARD_SIZE; x++) if(board[y][x] === 0) full = false;
        if (full) rowsToClear.push(y);
    }
    for(let x=0; x<BOARD_SIZE; x++) {
        let full = true; for(let y=0; y<BOARD_SIZE; y++) if(board[y][x] === 0) full = false;
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
            finishTurnEvents(skipPieceGen);
        }, 300);
    } else {
        finishTurnEvents(skipPieceGen);
    }
}

function finishTurnEvents(skipPieceGen) {
    if (gameMode === 'bomb' && moves > 0 && moves % 5 === 0) spawnBomb();
    drawBoard();
    if (!skipPieceGen && currentPieces.every(p => p === null)) generatePieces();
    else checkGameOver();
}

function spawnBomb() {
    let emptyCells = [];
    for(let y=0; y<BOARD_SIZE; y++) {
        for(let x=0; x<BOARD_SIZE; x++) if (board[y][x] === 0) emptyCells.push({x, y});
    }
    if (emptyCells.length > 0) {
        let spot = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        
        // Random bomb timer 6-15 logic
        let timer;
        let r = Math.random();
        if (r < 0.15) timer = Math.floor(Math.random() * 2) + 6; // 6-7 (Uncommon)
        else if (r < 0.85) timer = Math.floor(Math.random() * 3) + 8; // 8-10 (Common)
        else timer = Math.floor(Math.random() * 5) + 11; // 11-15 (Uncommon)
        
        board[spot.y][spot.x] = { timer: timer };
    }
}

// ---- BONUS SYSTEM ----

function updateBonusUI() {
    ['remove', 'move', 'reroll', 'hint'].forEach(b => {
        let btn = document.getElementById(`btn-${b}`);
        document.getElementById(`badge-${b}`).innerText = bonuses[b];
        if(bonuses[b] <= 0) btn.classList.add('disabled');
        else btn.classList.remove('disabled');
        btn.classList.remove('active');
    });

    let defBtn = document.getElementById('btn-defuse');
    if (defuseCooldown > 0) {
        document.getElementById('badge-defuse').innerText = defuseCooldown; // Shows cooldown
        defBtn.classList.add('disabled');
    } else {
        document.getElementById('badge-defuse').innerText = bonuses.defuse;
        if(bonuses.defuse <= 0) defBtn.classList.add('disabled');
        else defBtn.classList.remove('disabled');
    }
    defBtn.classList.remove('active');
    
    document.getElementById('bonus-status').classList.add('hidden');
    document.querySelectorAll('.cell').forEach(c => c.classList.remove('selectable'));
}

function toggleBonus(type) {
    if (bonuses[type] <= 0 && !(type === 'defuse' && defuseCooldown === 0 && bonuses.defuse > 0)) return;
    
    if (activeBonus === type || activeBonus === type + '_pickup' || activeBonus === type + '_place') {
        activeBonus = null; // Cancel
        updateBonusUI();
        return;
    }
    
    activeBonus = type === 'move' ? 'move_pickup' : type;
    updateBonusUI();
    document.getElementById(`btn-${type}`).classList.add('active');
    
    let status = document.getElementById('bonus-status');
    status.classList.remove('hidden');
    
    if (activeBonus === 'remove') status.innerText = "Tap a block to destroy it.";
    if (activeBonus === 'move_pickup') status.innerText = "Tap a block to pick it up.";
    if (activeBonus === 'defuse') status.innerText = "Tap a bomb to defuse it.";

    // Highlight valid selectable items
    for(let y=0; y<BOARD_SIZE; y++) {
        for(let x=0; x<BOARD_SIZE; x++) {
            let el = document.getElementById(`cell-${x}-${y}`);
            if (activeBonus === 'remove' || activeBonus === 'move_pickup') {
                if(board[y][x] === 1) el.classList.add('selectable');
            } else if (activeBonus === 'defuse') {
                if(typeof board[y][x] === 'object') el.classList.add('selectable');
            }
        }
    }
}

function handleBoardTap(e, x, y) {
    if (!activeBonus) return;
    
    if (activeBonus === 'remove' && board[y][x] === 1) {
        board[y][x] = 0;
        bonuses.remove--;
        activeBonus = null;
        advanceTurn(true);
    } 
    else if (activeBonus === 'move_pickup' && board[y][x] === 1) {
        board[y][x] = 0;
        moveBuffer = {x, y};
        activeBonus = 'move_place';
        drawBoard(); // Redraw immediately to show block gone
        document.getElementById('bonus-status').innerText = "Tap an empty spot to place it.";
        
        // Highlight empty spots
        for(let by=0; by<BOARD_SIZE; by++) {
            for(let bx=0; bx<BOARD_SIZE; bx++) {
                if(board[by][bx] === 0) document.getElementById(`cell-${bx}-${by}`).classList.add('selectable');
            }
        }
    }
    else if (activeBonus === 'move_place' && board[y][x] === 0) {
        board[y][x] = 1;
        bonuses.move--;
        activeBonus = null;
        advanceTurn(true); // Might clear a line!
    }
    else if (activeBonus === 'defuse' && typeof board[y][x] === 'object') {
        board[y][x] = 1; // Turn bomb into normal block
        bonuses.defuse--;
        defuseCooldown = 15; // Recharge after 15 moves
        activeBonus = null;
        advanceTurn(true);
    }
}

function useReroll() {
    if (activeBonus || bonuses.reroll <= 0) return;
    bonuses.reroll--;
    generatePieces();
    advanceTurn(true);
}

function useHint() {
    if (activeBonus || bonuses.hint <= 0) return;
    
    let best = null; let maxScore = -1;
    currentPieces.forEach((p, i) => {
        if(!p) return;
        let rot = p;
        for(let r=0; r<4; r++) { // Check all rotations
            for(let y=0; y<BOARD_SIZE; y++) {
                for(let x=0; x<BOARD_SIZE; x++) {
                    if(canPlace(rot, x, y)) {
                        // Simulate placement score
                        let lines = simulateLines(rot, x, y);
                        if(lines > maxScore) { maxScore = lines; best = { p: rot, index: i, x, y }; }
                    }
                }
            }
            rot = rotateMatrix(rot);
        }
    });

    if (best) {
        bonuses.hint--;
        currentPieces[best.index] = best.p; // Rotate piece in tray to match hint
        drawTray();
        drawHighlights(best.p, best.x, best.y, 'hint-highlight');
        activeBonus = null;
        setTimeout(() => clearHighlights(), 2000); // Remove after 2 seconds
        advanceTurn(true);
    } else {
        alert("No valid moves found!"); // Rare edge case
    }
}

function simulateLines(piece, startX, startY) {
    // Temp board clone
    let temp = board.map(row => [...row]);
    for(let r=0; r<piece.length; r++) {
        for(let c=0; c<piece[0].length; c++) {
            if(piece[r][c]) temp[startY+r][startX+c] = 1;
        }
    }
    let cleared = 0;
    for(let y=0; y<BOARD_SIZE; y++) {
        if(temp[y].every(v => v !== 0)) cleared++;
    }
    for(let x=0; x<BOARD_SIZE; x++) {
        let col = true;
        for(let y=0; y<BOARD_SIZE; y++) if(temp[y][x]===0) col = false;
        if(col) cleared++;
    }
    return cleared;
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
        let p = piece;
        for(let r=0; r<4; r++) {
            for(let y=0; y<BOARD_SIZE; y++) {
                for(let x=0; x<BOARD_SIZE; x++) if (canPlace(p, x, y)) canMove = true;
            }
            p = rotateMatrix(p);
        }
    });
    // Check if player has bonuses that could save them
    let hasSaveBonus = (bonuses.remove > 0) || (bonuses.move > 0) || (bonuses.reroll > 0);
    
    if (!canMove && !hasSaveBonus) endGame();
    else if (!canMove && hasSaveBonus) {
        document.getElementById('bonus-status').innerText = "No moves left! Use a bonus to survive!";
        document.getElementById('bonus-status').classList.remove('hidden');
    }
}

function endGame() {
    showScreen('game-over-screen');
    document.getElementById('final-score').innerText = score;
    document.getElementById('final-best-score').innerText = highScores[gameMode];
}

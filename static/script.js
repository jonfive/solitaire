let gameState = null;
let draggedCard = null;
let draggedCards = [];
let dragStartPos = { x: 0, y: 0 };
let originalParent = null;

function createCard(cardData, index = 0, total = 1) {
    const card = document.createElement('div');
    card.className = `card ${cardData.face_up ? '' : 'face-down'}`;
    card.dataset.id = cardData.id;
    
    if (cardData.face_up) {
        const isRed = ['hearts', 'diamonds'].includes(cardData.suit);
        card.classList.add(isRed ? 'red' : 'black');
        
        const content = document.createElement('div');
        content.className = 'card-content';
        
        const value = document.createElement('div');
        value.textContent = cardData.value;
        
        const suit = document.createElement('div');
        suit.textContent = getSuitSymbol(cardData.suit);
        
        content.appendChild(value);
        content.appendChild(suit);
        card.appendChild(content);
    }
    
    if (total > 1) {
        card.style.top = `${index * 30}px`;
    }
    
    card.addEventListener('mousedown', startDrag);
    return card;
}

function getSuitSymbol(suit) {
    const symbols = {
        'hearts': '♥',
        'diamonds': '♦',
        'clubs': '♣',
        'spades': '♠'
    };
    return symbols[suit];
}

function startDrag(e) {
    if (e.button !== 0) return; // Only left click
    
    const card = e.target.closest('.card');
    if (!card || !card.closest('.pile') || !gameState) return;
    
    const pile = card.closest('.pile');
    originalParent = pile;
    
    // Find all cards that should be dragged together
    const cards = Array.from(pile.children);
    const cardIndex = cards.indexOf(card);
    draggedCards = cards.slice(cardIndex);
    
    if (draggedCards.some(card => card.classList.contains('face-down'))) {
        draggedCards = [];
        return;
    }
    
    draggedCard = card;
    dragStartPos = {
        x: e.clientX - card.offsetLeft,
        y: e.clientY - card.offsetTop
    };
    
    draggedCards.forEach(card => card.classList.add('dragging'));
    
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
    
    e.preventDefault();
}

function drag(e) {
    if (!draggedCard || draggedCards.length === 0) return;
    
    const offsetY = draggedCards.length > 1 ? 30 : 0;
    
    draggedCards.forEach((card, index) => {
        card.style.position = 'fixed';
        card.style.left = `${e.clientX - dragStartPos.x}px`;
        card.style.top = `${e.clientY - dragStartPos.y + (index * offsetY)}px`;
        card.style.zIndex = '1000';
    });
    
    // Highlight valid drop targets
    const validTargets = findValidDropTargets();
    document.querySelectorAll('.can-drop').forEach(el => el.classList.remove('can-drop'));
    validTargets.forEach(target => target.classList.add('can-drop'));
}

function stopDrag(e) {
    if (!draggedCard || draggedCards.length === 0) return;
    
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
    
    const dropTarget = findDropTarget(e);
    
    if (dropTarget && isValidMove(dropTarget)) {
        const fromType = getLocationType(originalParent);
        const toType = getLocationType(dropTarget);
        const fromIndex = parseInt(originalParent.dataset.index);
        const toIndex = parseInt(dropTarget.dataset.index);
        const cardIndex = Array.from(originalParent.children).indexOf(draggedCard);
        
        makeMove(fromType, fromIndex, toType, toIndex, cardIndex);
    } else {
        updateGameDisplay();
    }
    
    draggedCards.forEach(card => {
        card.classList.remove('dragging');
        card.style.position = '';
        card.style.left = '';
        card.style.top = '';
        card.style.zIndex = '';
    });
    
    document.querySelectorAll('.can-drop').forEach(el => el.classList.remove('can-drop'));
    
    draggedCard = null;
    draggedCards = [];
    originalParent = null;
}

function findDropTarget(e) {
    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    return elements.find(el => el.classList.contains('pile'));
}

function findValidDropTargets() {
    if (!draggedCard) return [];
    
    const targets = [];
    document.querySelectorAll('.pile').forEach(pile => {
        if (pile !== originalParent && isValidMove(pile)) {
            targets.push(pile);
        }
    });
    
    return targets;
}

function isValidMove(target) {
    if (!draggedCard || !gameState) return false;
    
    const fromType = getLocationType(originalParent);
    const toType = getLocationType(target);
    const draggedCardData = findCardInGameState(draggedCard.dataset.id);
    
    if (!draggedCardData) return false;
    
    if (toType === 'foundation') {
        const foundation = gameState.foundations[parseInt(target.dataset.index)];
        if (foundation.length === 0) {
            return draggedCardData.value === 'A';
        }
        const topCard = foundation[foundation.length - 1];
        const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        return draggedCardData.suit === topCard.suit &&
               values.indexOf(draggedCardData.value) === values.indexOf(topCard.value) + 1;
    }
    
    if (toType === 'tableau') {
        const tableau = gameState.tableau[parseInt(target.dataset.index)];
        if (tableau.length === 0) {
            return draggedCardData.value === 'K';
        }
        const topCard = tableau[tableau.length - 1];
        const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        const isRed = ['hearts', 'diamonds'].includes(draggedCardData.suit);
        const isTopRed = ['hearts', 'diamonds'].includes(topCard.suit);
        return isRed !== isTopRed &&
               values.indexOf(draggedCardData.value) === values.indexOf(topCard.value) - 1;
    }
    
    return false;
}

function getLocationType(element) {
    if (element.classList.contains('foundation')) return 'foundation';
    if (element.classList.contains('tableau-pile')) return 'tableau';
    if (element.id === 'waste') return 'waste';
    if (element.id === 'stock') return 'stock';
    return null;
}

function findCardInGameState(cardId) {
    const [value, suit] = cardId.split('_');
    const locations = [
        ...gameState.tableau,
        ...gameState.foundations,
        gameState.waste,
        gameState.stock
    ];
    
    for (const location of locations) {
        const card = location.find(c => c.value === value && c.suit === suit);
        if (card) return card;
    }
    return null;
}

async function makeMove(fromType, fromIndex, toType, toIndex, cardIndex) {
    const response = await fetch('/api/move-card', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            fromType,
            fromIndex,
            toType,
            toIndex,
            cardIndex
        })
    });
    
    const data = await response.json();
    if (data.success) {
        gameState = data;
        updateGameDisplay();
        
        if (data.won) {
            setTimeout(() => {
                showWinAnimation();
            }, 500);
        }
    }
}

function showWinAnimation() {
    const winAnimation = document.getElementById('win-animation');
    winAnimation.style.display = 'block';
    const cardCascade = document.querySelector('.card-cascade');
    
    // Create cascading cards
    for (let i = 0; i < 52; i++) {
        const card = document.createElement('div');
        card.className = 'cascading-card';
        card.style.left = `${Math.random() * 100}%`;
        card.style.animationDelay = `${Math.random() * 2}s`;
        cardCascade.appendChild(card);
    }
    
    // Remove animation after it's done
    setTimeout(() => {
        winAnimation.style.display = 'none';
        cardCascade.innerHTML = '';
    }, 4000);
}

async function updateGameState() {
    const response = await fetch('/api/game-state');
    gameState = await response.json();
    updateGameDisplay();
}

function updateGameDisplay() {
    if (!gameState) return;
    
    // Update score
    document.getElementById('score').textContent = `Score: ${gameState.score}`;
    
    // Update stock
    const stock = document.getElementById('stock');
    stock.innerHTML = '';
    if (gameState.stock.length > 0) {
        const card = createCard(gameState.stock[gameState.stock.length - 1]);
        stock.appendChild(card);
    }
    
    // Update waste
    const waste = document.getElementById('waste');
    waste.innerHTML = '';
    if (gameState.waste.length > 0) {
        const card = createCard(gameState.waste[gameState.waste.length - 1]);
        waste.appendChild(card);
    }
    
    // Update foundations
    gameState.foundations.forEach((foundation, i) => {
        const foundationEl = document.querySelector(`.foundation[data-index="${i}"]`);
        foundationEl.innerHTML = '';
        if (foundation.length > 0) {
            const card = createCard(foundation[foundation.length - 1]);
            foundationEl.appendChild(card);
        }
    });
    
    // Update tableau
    gameState.tableau.forEach((pile, i) => {
        const tableauPile = document.querySelector(`.tableau-pile[data-index="${i}"]`);
        tableauPile.innerHTML = '';
        pile.forEach((cardData, j) => {
            const card = createCard(cardData, j, pile.length);
            tableauPile.appendChild(card);
        });
    });
}

// Event Listeners
document.getElementById('new-game').addEventListener('click', async () => {
    const response = await fetch('/api/new-game', {
        method: 'POST'
    });
    gameState = await response.json();
    updateGameDisplay();
});

document.getElementById('stock').addEventListener('click', async () => {
    const response = await fetch('/api/draw-card', {
        method: 'POST'
    });
    gameState = await response.json();
    updateGameDisplay();
});

// Initialize game
updateGameState();
const socket = io();

import { Droppable } from '@shopify/draggable';

let droppable = new Droppable();

const Timer = require('easytimer.js').Timer;
const countUpTimer = new Timer();

countUpTimer.addEventListener('secondsUpdated', () => {
    let values = countUpTimer.getTimeValues();
    let display = values.toString().replace(/^[^(1-9)]*/, '');
    document.querySelector('#timer').textContent = display;
});

const addDrag = () => {
    if (droppable) droppable.destroy();

    const containers = document.querySelectorAll('.BlockLayout');

    if (containers.length === 0) {
      return false;
    }
  
    droppable = new Droppable(containers, {
      draggable: '.Block--isDraggable',
      dropzone: '.BlockWrapper--isDropzone',
      mirror: {
        constrainDimensions: true,
      },
    });
    console.log(droppable);

    preventFoundations();
  
    // --- Draggable events --- //
    droppable.on('drag:start', (evt) => {
        let currentCard = evt.source.querySelector('card');
        let wrapper = evt.source.parentElement

        console.log(`%cDragStartEvent (${currentCard.classList[2]} ${currentCard.classList[1]})`, 'font-size: 25px; padding: 25px');
        console.log(evt);

        let workPileStacks = evt.sourceContainer.querySelectorAll('workpile > stack');
        console.log('Work pile stacks:', workPileStacks);

        workPileStacks.forEach((s, i) => {
            let children = s.children;
            if (children.length > 0) {
                let last = s.lastChild;
                if (last.classList.contains('draggable-dropzone--occupied')) {
                    console.groupCollapsed(`Work pile #${i + 1} has a occupied last child`)
                    let lastCard = last.querySelector('card');

                    console.log('cards:', {
                        currentCard,
                        lastCard
                    });

                    let canBuild = ableToBuild(currentCard, lastCard);
                    console.log('Able to build:', canBuild);

                    if (canBuild) {
                        placeGhostZone(s);
                        console.log('Placed ghost zone on stack:', s);
                    }
                    console.groupCollapsed();
                };
            }

        });

        let foundationPiles = document.querySelectorAll('.foundations > stack');
        foundationPiles.forEach((stack, i) => {
            let cards = stack.querySelectorAll('.draggable-dropzone--occupied');
            if (cards.length > 0) {
                let lastCard = cards[cards.length - 1].querySelector('card');
                console.log(`Last card in pile ${i + 1} is`, lastCard)
                let canBuild = ableToBuild(currentCard, lastCard, {
                    sameSuit: true
                });
                console.log('canBuild:', canBuild);
                if (canBuild == true) {
                    if (currentCard.nextElementSibling && currentCard.parentElement.tagName == 'STACK') {
                        return console.warn(`Can build, but has siblings.`)
                    }
                    addSlot(stack);

                    allowFoundations();
                }
            } else if (currentCard.classList[2] == 'A') {
                console.log('ACE! Card can be built on empty foundation');
                addSlot(stack);

                allowFoundations();
            }
        })

        if (!evt.source.parentElement.parentElement.classList.contains('foundations')) {
            setTimeout(() => {
                moveHandler(evt, evt.source.parentElement);
                document.onmousemove = (e) => {
                    moveHandler(e, wrapper);
                }
            })
        }
    });

    droppable.on('drag:move', (evt) => {
        if (!evt.source.parentElement.parentElement.classList.contains('foundations')) {
        }
    });
  
    const moveHandler = (evt, currentCard) => {
        let mirror = currentCard?.querySelector('.draggable-mirror');
        if (mirror) {
            if (currentCard.nextElementSibling) {
                let siblings = [...currentCard.parentElement.children].slice([...currentCard.parentElement.children].indexOf(currentCard) + 1) 
                console.warn('has siblings.', {
                    evt,
                    siblings,
                });
                siblings.forEach((s, i) => {
                    s.classList.add('sibling-drag')

                    let prevTransform = mirror.style.transform.replace('translate3d(', '').replace(')', '').split(', ')
                    
                    let xTransform = prevTransform[0]; 
                    let yTransform = (parseFloat(prevTransform[1].replace('px', '')) + ((i + 1) * 2)) + 'px';
                    console.log({xTransform, yTransform, 'yTransformAdd': ((i + 1) * 2) })
                    
                    s.style.transform = `translate3d(${xTransform}, ${yTransform}, 0px)`;
                    s.style.top = `${((i + 1) * 16)}px`
                })
            }
        }
    }

    droppable.on('drag:stop', (evt) => {
        let currentCard = evt.source.querySelector('card');
        console.log(evt)
        document.onmousemove = null;
        preventFoundations();
        if (evt.data.sourceContainer.tagName == 'PLAYER') {
            let piles = [...evt.data.sourceContainer.children];

            // Foundation piles 
            let foundationPiles = document.querySelectorAll('.foundations > stack')
            foundationPiles.forEach(stack => {
                let last = stack.lastChild;
                if (last?.classList && !(last.classList.contains('draggable-dropzone--occupied'))) {
                    console.warn('empty ghost zone', last);
                    last.remove();
                } 
            })

            // Work piles
            let workPileStacks = piles[0].querySelectorAll('workpile > stack');

            let stackSource = evt.data.source.parentElement.parentElement;
            let originWrapper = evt.data.originalSource.parentElement;

            setTimeout(() => {
                if (originWrapper.parentElement.tagName == 'NERTZPILE') {
                    if (originWrapper.querySelector('card')) {
                        console.log(originWrapper)
                        return console.warn('dropped in same spot.')
                    }

                    //console.log({ stackSource });
                    console.log('Nertz card moved');
                    
                    socket.emit('nertz-pile', {
                        id: socket.id,
                        nertzPile: originWrapper.parentElement.innerHTML,
                    });
                }

                if (stackSource.parentElement.tagName == 'WORKPILE') {
                    if (originWrapper.querySelector('card')) {
                        console.log(originWrapper)
                        return console.warn('dropped in same spot.')
                    }

                    //console.log({ stackSource });
                    console.log('Dropped in a work pile');

                    let suit = currentCard.classList[1];
                    let number = currentCard.classList[2];
                    let pileIndex =  [...stackSource.parentElement.children].indexOf(stackSource);

                    socket.emit('work-pile', {
                        sid: socket.id,
                        pileIndex: pileIndex,
                        suit: suit,
                        number: number,
                        actionReadable: `${number} of ${suit} dropped on work pile index[${pileIndex}]`,
                        raw: stackSource.parentElement.innerHTML
                    });

                    return;
                }

                if (stackSource.parentElement.classList.contains('foundations')) {
                    if (originWrapper.querySelector('card')) {
                        console.log(originWrapper)
                        return console.warn('dropped in same spot.')
                    }

                    //console.log({ stackSource });
                    console.log('Dropped in a foundation');

                    let stackIndex =  [...stackSource.parentElement.children].indexOf(stackSource);
                    
                    socket.emit('foundation-stack', {
                        sid: socket.id,
                        stackIndex: stackIndex,
                        raw: stackSource.innerHTML
                    });
                }
            });

            setTimeout(() => {
                workPileStacks.forEach((s, i) => {
                    let children = s.children;
                    let firstChild = s.firstChild;

                    for (let w = children.length; w--;) {
                        let c = children[w];

                        if (c != firstChild && !(c.classList.contains('draggable-dropzone--occupied'))) {
                            console.warn('empty ghost zone.', c)
                            c.remove();
                        }                    
                    }
                })
            });

            let siblings = piles[0].querySelectorAll('.sibling-drag');
            siblings.forEach(s => {
                s.classList.remove('sibling-drag');
                s.style.transform = null;
                s.style.top = null;

                let destinationStack = evt.data.source.parentElement.parentElement;
                destinationStack.appendChild(s);
            })

            // Nertz pile
            let nertzPileCards = [...piles[1].children];
            setTimeout(() => {
                for (let i = nertzPileCards.length; i--;) {
                    let c = nertzPileCards[i];

                    if (nertzPileCards.length == 1) {
                        c.classList.add('end');
                        console.log(`${evt.data.sourceContainer.dataset.player} has won!`);

                        countUpTimer.stop();

                        let field = document.getElementById('game-field');
                        socket.emit('win', {
                            id: socket.id,
                            timeElapsed: countUpTimer.getTotalTimeValues().seconds,
                            round: field.dataset.round,             
                        });
                        field.dataset.round = parseInt(field.dataset.round) + 1;
                        
                        break;
                    }

                    if (c.children.length > 0) {
                        continue;
                    } 
                    
                    c.remove();
                }
                let last = piles[1].lastChild
                last?.classList?.remove('last');
                last?.classList?.add('last');
            });

            // Stock pile
            let stockPile = piles[2].children[0];
            checkPile(stockPile)

            // Waste pile
            let wastePile = piles[2].children[1];
            checkPile(wastePile)
        }
    });
}

const preventFoundations = () => {
    document.querySelector('.foundations').classList.add('not-allowed')
}
const allowFoundations = () => {
    document.querySelector('.foundations').classList.remove('not-allowed');
    document.querySelector('.foundations').onmouseenter = null;
    document.querySelector('.foundations').onmouseleave = null;
}

const checkPile = (pile) => {
    //console.log('Pile', pile)
    let cards = [...pile.children];
    setTimeout(() => {
        for (let i = cards.length; i--;) {
            let c = cards[i];

            if (c.children.length > 0) {
                continue;
            } 
            
            console.warn('removing', c, 'no children.')
            c.remove();
        }

        let prevLast = pile.querySelectorAll('.last');
        if (prevLast) {
            prevLast.forEach(l => {
                l.classList.remove('last');
            })
        }

        let last = pile.lastChild
        last?.classList?.remove('last');
        last?.classList?.add('last');
    });
}



//

const playerHTML = (n, sid, actualN) => {
    let playerWrap = document.createElement('div');
    playerWrap.innerHTML = `
    <player id="player${n}" class="BlockLayout" data-id="${sid}" data-player="PLAYER ${actualN}">
        <workpile class="work-pile">
            <stack></stack>
            <stack></stack>
            <stack></stack>
            <stack></stack>
        </workpile>
        <nertzpile class="nertz-pile">

        </nertzpile>
        <stockpile class="stock-pile">
            <div class="stock">
            </div>
            <div class="waste"></div>
        </stockpile>
    </player>
    `
    return [playerWrap.children[0], {
        workPile: playerWrap.querySelector('workpile'),
        nertzPile: playerWrap.querySelector('nertzpile'),
        stockPile: playerWrap.querySelector('stockpile'),
    }];
}

const getCard = (player, card, index) => {
    let number = card.number;
    let suit = card.suit;
    

    let suitSymbol;
    if (suit == 'spades') {
        suitSymbol = `
        <svg id="spade-symbol" class="suit-symbol" width="30" height="26" viewBox="0 0 30 26" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 24.5L15 2L28 24.5H2Z" stroke="black" stroke-width="1.5"/>
        </svg>      
        `
    } else if (suit == 'clubs') {
        suitSymbol = `
        <svg id="club-symbol" class="suit-symbol" width="28" height="26" viewBox="0 0 28 26" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="21.5" cy="19.5" r="5.5" transform="rotate(180 21.5 19.5)" stroke="black" stroke-width="1"/>
            <circle cx="6.5" cy="19.5" r="5.5" transform="rotate(180 6.5 19.5)" stroke="black" stroke-width="1"/>
            <circle cx="14" cy="6.5" r="5.5" transform="rotate(180 14 6.5)" stroke="black" stroke-width="1"/>
        </svg>        
        `
    } else if (suit == 'hearts') {
        suitSymbol = `
        <svg id="heart-symbol" class="suit-symbol" width="30" height="26" viewBox="0 0 30 26" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M28 1L15 23.5L2 0.999998L28 1Z" stroke="#D33030" stroke-width="2"/>
        </svg>        
        `
    } else {
        suitSymbol = `
        <svg id="diamond-symbol" class="suit-symbol" width="31" height="31" viewBox="0 0 31 31" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15.6066 29.2132L1.99999 15.6066L15.6066 2L29.2132 15.6066L15.6066 29.2132Z" stroke="#D33030" stroke-width="2"/>
        </svg>        
        `
    }

    let cardWrap = document.createElement('div');
    cardWrap.innerHTML = `
    <div class="BlockWrapper BlockWrapper--isDropzone draggable-dropzone--occupied" data-index="${index}">
        <span class="Block Block--item1 Block--isDraggable" title="Click to drag" tabindex="0">
            <div class="BlockContent">

                <card class="playing-card ${suit} ${number}">
                    <div class="top-banner">
                        <span class="number">
                        ${number}
                        </span>
                        ${suitSymbol}  
                    </div>

                    <span class="number">
                        ${number}
                    </span>
                    
                    <div class="bottom-banner">
                        <span class="number">
                        ${number}
                        </span>
                        ${suitSymbol}  
                    </div>
                </card>

                <div class="back">
                    <svg width="60" height="99" viewBox="0 0 60 99" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <mask id="mask0_12_21" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="-1" y="-1" width="62" height="101">
                        <path d="M59.5489 0L4.9683e-06 99" stroke="#959595" stroke-linecap="round"/>
                        </mask>
                        <g mask="url(#mask0_12_21)">
                        <path d="M51.3609 13.207L6.69927 87.6431" stroke="#333" stroke-width="1" stroke-linecap="round"/>
                        </g>
                    </svg>    
                </div>
            </div>
        </span>
    </div>
    `

    return cardWrap.children[0];
}

const getSlot = () => {
    let slotWrap = document.createElement('div');
    slotWrap.innerHTML = `
    <div class="BlockWrapper BlockWrapper--isDropzone data-dropzone="1"">
        <span class="Block Block--typeStripes">
            <div class="BlockContent"></div>
        </span>
    </div>
    `
    return slotWrap.children[0];
}
const addSlot = (container, classListToAdd=[]) => {
    let stack = document.createElement('stack');
    stack.innerHTML = `
    <div class="BlockWrapper BlockWrapper--isDropzone data-dropzone="1"">
        <span class="Block Block--typeStripes">
            <div class="BlockContent"></div>
        </span>
    </div>
    `
    let slot = stack.children[0];

    if (classListToAdd.length > 0) slot.classList.add(classListToAdd);

    container.appendChild(slot);
    return container.lastChild;
}

const removeFoundations = (n, options={}) => {
    // Only allowed when in lobby / party
    // There shouldn't be any cards in because 
    // the game shouldn't have started yet.
    let foundationsContainer = document.querySelector('.foundations');
    let count = n * 4;

    if (options.safe == true) {
        let curr = 0;
        for(let i = 1; i <= count;) {
            let f = foundationsContainer.children[curr];

            curr++;
            if (f.children.length > 0) {
                continue;
            }

            f.remove();
            i++;
        }   

        return console.log('removing empty foundations');
    }

    let last = foundationsContainer.children.length - 1;
    for(let i = 1; i <= count; i++) {
        foundationsContainer.children[last].remove();
        last--;
    }
}
const populateFoundations = (n, clear=true) => {
    let foundationsContainer = document.querySelector('.foundations');
    
    if (clear == true) {
        foundationsContainer.innerHTML = '';
    }

    let count = n * 4;

    for(let i = 1; i <= count; i++) {
        let stack = document.createElement('stack');
        foundationsContainer.appendChild(stack);
    }
}

const fullDeck = [
    {
        "suit": "spades",
        "number": "A"
    },
    {
        "suit": "spades",
        "number": 2
    },
    {
        "suit": "spades",
        "number": 3
    },
    {
        "suit": "spades",
        "number": 4
    },
    {
        "suit": "spades",
        "number": 5
    },
    {
        "suit": "spades",
        "number": 6
    },
    {
        "suit": "spades",
        "number": 7
    },
    {
        "suit": "spades",
        "number": 8
    },
    {
        "suit": "spades",
        "number": 9
    },
    {
        "suit": "spades",
        "number": 10
    },
    {
        "suit": "spades",
        "number": "J"
    },
    {
        "suit": "spades",
        "number": "Q"
    },
    {
        "suit": "spades",
        "number": "K"
    },
    {
        "suit": "clubs",
        "number": "A"
    },
    {
        "suit": "clubs",
        "number": 2
    },
    {
        "suit": "clubs",
        "number": 3
    },
    {
        "suit": "clubs",
        "number": 4
    },
    {
        "suit": "clubs",
        "number": 5
    },
    {
        "suit": "clubs",
        "number": 6
    },
    {
        "suit": "clubs",
        "number": 7
    },
    {
        "suit": "clubs",
        "number": 8
    },
    {
        "suit": "clubs",
        "number": 9
    },
    {
        "suit": "clubs",
        "number": 10
    },
    {
        "suit": "clubs",
        "number": "J"
    },
    {
        "suit": "clubs",
        "number": "Q"
    },
    {
        "suit": "clubs",
        "number": "K"
    },
    {
        "suit": "hearts",
        "number": "A"
    },
    {
        "suit": "hearts",
        "number": 2
    },
    {
        "suit": "hearts",
        "number": 3
    },
    {
        "suit": "hearts",
        "number": 4
    },
    {
        "suit": "hearts",
        "number": 5
    },
    {
        "suit": "hearts",
        "number": 6
    },
    {
        "suit": "hearts",
        "number": 7
    },
    {
        "suit": "hearts",
        "number": 8
    },
    {
        "suit": "hearts",
        "number": 9
    },
    {
        "suit": "hearts",
        "number": 10
    },
    {
        "suit": "hearts",
        "number": "J"
    },
    {
        "suit": "hearts",
        "number": "Q"
    },
    {
        "suit": "hearts",
        "number": "K"
    },
    {
        "suit": "diamonds",
        "number": "A"
    },
    {
        "suit": "diamonds",
        "number": 2
    },
    {
        "suit": "diamonds",
        "number": 3
    },
    {
        "suit": "diamonds",
        "number": 4
    },
    {
        "suit": "diamonds",
        "number": 5
    },
    {
        "suit": "diamonds",
        "number": 6
    },
    {
        "suit": "diamonds",
        "number": 7
    },
    {
        "suit": "diamonds",
        "number": 8
    },
    {
        "suit": "diamonds",
        "number": 9
    },
    {
        "suit": "diamonds",
        "number": 10
    },
    {
        "suit": "diamonds",
        "number": "J"
    },
    {
        "suit": "diamonds",
        "number": "Q"
    },
    {
        "suit": "diamonds",
        "number": "K"
    }
]

class Deck {
    constructor() {
        this.deck = structuredClone(fullDeck);
    }

    reset () {
        this.deck = structuredClone(fullDeck)
    }

    shuffle () {
        let array = this.deck;
        let currentIndex = array.length,  randomIndex;

        // While there remain elements to shuffle.
        while (currentIndex != 0) {
      
          // Pick a remaining element.
          randomIndex = Math.floor(Math.random() * currentIndex);
          currentIndex--;
      
          // And swap it with the current element.
          [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }
      
        this.deck = array;
        return array;
    }

    pickFromTop () {
        let topCard = this.deck[0];
        this.deck.splice(0, 1);
        return topCard;
    }

    pickRandom () {
        let randomIndex = Math.floor(Math.random() * (this.deck.length - 1));  
        let randomCard = this.deck[randomIndex];
        this.deck.splice(randomIndex, 1);
        return randomCard;
    }
}



const populatePlayerPile = (playerNum, socketId, actualNum) => {
    let field = document.getElementById('game-field');
    let player, handles;
    let i = playerNum;

    if (document.querySelector(`player[id="player${playerNum}"`)) {
        player = document.querySelector(`player[id="player${playerNum}"`);
        console.log('setting player to', player)

    } else {
        [player, handles] = playerHTML(i, socketId, actualNum);
        field.appendChild(player);
        console.log('creating html template', player)
    }

    let deck = new Deck();
    deck.shuffle();
    
    [...player.children].forEach(pile => {
        console.log({pile})
        // 4 cards
        if (pile.tagName == 'WORKPILE') {
            pile.innerHTML = `<stack></stack>
            <stack></stack>
            <stack></stack>
            <stack></stack>`;
            for(let w = 0; w <= 3; w++) {
                let initialSlot = addSlot(pile.children[w], ['placeholder']);
                let c = getCard(`player${i}`, deck.pickFromTop(), w);
                initialSlot.appendChild(c.querySelector('span'));
                initialSlot.classList.add('draggable-dropzone--occupied')
            }
        }

        // 13 cards
        if (pile.tagName == 'NERTZPILE') {
            pile.innerHTML = '';
            for(let z = 1; z <= 13; z++) {
                let c = getCard(`player${i}`, deck.pickFromTop(), z);
                pile.appendChild(c)

                if (z == 13) {
                    c.classList.add('last');
                }
            }
        }

        // 52-13-4 = 35 cards
        if (pile.tagName == 'STOCKPILE') {
            pile.innerHTML = `           
            <div class="stock"></div>
            <div class="waste"></div>`;
            if (i == 1) {
                console.warn('adding stock pile', player)
                let stockPile = pile.children[0];
                for(let z = 1; z <= 35; z++) {
                    let c = getCard(`player${i}`, deck.pickFromTop(), z);
                    c.classList.add('flipped')
                    stockPile.appendChild(c);

                    if (z == 35) {
                        c.classList.add('last');
                        assignStockPileHandler(pile)
                    }
                }

                let wastePile = pile.children[1];
                for(let w = 1; w <= 1; w++) {
                    //addSlot(wastePile)
                }
            } else {
                //pile.classList.add('hide')
            }
        }

    })
    console.log(player)
    
    console.group(`%c DECK`, 'padding: 10px 15px;')
    console.log(deck);
    console.groupEnd();

    return [...player.children];
}

const assignStockPileHandler = (pile) => {
    console.log('Assigning to', pile);
    pile.onclick = () => {
        stockPileHandler(pile.children[0])
    };
}

const stockPileHandler = (pile) => {
    let waste = pile.nextElementSibling;
    let stockPileCards = [...pile.children];
    setTimeout(() => {
        let count = 1;
        let lastZ = waste.lastChild?.style?.zIndex ?? 0;
        console.log('last child in waste:', waste.lastChild)

        let lastThreeCards = stockPileCards.slice(-3).reverse();

        if (lastThreeCards.length == 0) {
            pile.classList.remove('empty')
            console.warn('flipping stock pile back');

            let wastePileCards = [...waste.children].reverse();
            wastePileCards.forEach((w, i) => {
                w.style.zIndex = null;
                w.classList.add('flipped');
                w.classList.remove('waste');
                pile.appendChild(w);
            })
            return;
        };

        let prevLast = pile.querySelectorAll('.last');
        if (prevLast) {
            console.log(prevLast)
            prevLast.forEach(l => {
                l.classList.remove('last');
            })
        }

        lastThreeCards.forEach((c, i) => {
            setTimeout(() => {
                c.classList.remove('flipped');
                c.classList.add('waste');

                if (i == 2) {
                    console.log('adding .last to:', c)
                    c.classList.add('last')
                }
                //console.log('Flipped:', c);

                c.style.zIndex = (parseInt(lastZ) + (i + 1));
            }, count * 200);
            setTimeout(() => {
                waste.appendChild(c);
                //console.log('Appended to waste:', c);
            }, ((count * 200) + 500));

            count++;
        });

        pile.parentElement.onclick = null;

        setTimeout(() => {
            let prevLast = waste.querySelectorAll('.last:not(:last-child)');
            if (prevLast) {
                console.log(prevLast)
                prevLast.forEach(l => {
                    l.classList.remove('last');
                })
            }
            checkPile(pile);
            pile.parentElement.onclick = () => {
                stockPileHandler(pile)
            };
            if (stockPileCards.length <= 3) {
                pile.classList.add('empty')
            }
        }, 1100);
    });
}


// Work pile building

const ableToBuild = (currentCard, cardToBuildOn, options={
    sameSuit: false,
}) => {
    let currentSuitColor = currentCard.classList[1];
    if (currentSuitColor == 'diamonds' || currentSuitColor == 'hearts') {
        currentSuitColor = 'red';
    } else {
        currentSuitColor = 'black'
    }
    let currentNumber = currentCard.classList[2];
    if (!isNaN(currentNumber)) {
        currentNumber = parseInt(currentNumber);
    }

    let previousSuitColor = cardToBuildOn.classList[1];
    if (previousSuitColor == 'diamonds' || previousSuitColor == 'hearts') {
        previousSuitColor = 'red';
    } else {
        previousSuitColor = 'black'
    }
    let previousNumber = cardToBuildOn.classList[2];
    if (!isNaN(previousNumber)) {
        previousNumber = parseInt(previousNumber);
    }

    let numbers = ['A', 2, 3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K'];
    let indexOfCurrent = numbers.indexOf(currentNumber);
    let indexOfPrevious = numbers.indexOf(previousNumber);

    if (currentSuitColor != previousSuitColor) {
        if (options.sameSuit) {
            return false;
        }
    
        if (indexOfPrevious - indexOfCurrent == 1) {
            return true;
        }   
    } else {
        // Foundation piles (same color)
        if (indexOfCurrent - indexOfPrevious == 1 && options.sameSuit == true) {
            return true;
        }   
    }

    return false;
}

const placeGhostZone = (stack) => {
    let HTML = getSlot();
    //console.log('HTML:', HTML);

    stack.appendChild(HTML);
}
global.placeGhostZone = placeGhostZone;

global.populatePlayerPile = populatePlayerPile;

const allCall = (playerCount) => {
    addDrag();
}
allCall(3);





// Multiplayer


const nextRoundPiles = (data) => {
    let playerIds = data.players;

    let selfSocketIndex = playerIds.indexOf(socket.id);

    playerIds.forEach((id, i) => {
        let piles = populatePlayerPile((i + 1), socket.id, (i + 1));

        if (i == selfSocketIndex) {
            socket.emit('my-initial-piles', {
                workPile: piles[0].innerHTML,
                nertzPile: piles[1].innerHTML,
                id: socket.id
            })
        };
    })

    document.querySelectorAll(`.foundations > stack`).forEach(stack => {
        stack.innerHTML = '';
    })
    // THIS WORKS!!



    //countUpTimer.start();
}

const showPopper = () => {
    document.querySelector('.popper-wrapper').classList.remove('hide')
    document.querySelector('.popper-wrapper').classList.add('show')
}
const hidePopper = () => {
    document.querySelector('.popper-wrapper').classList.remove('show')
}
const populateStatPopup = (roomData) => {
    const statPopup = document.querySelector('.stat-popup');

    const roundContainer = (data) => Object.assign(document.createElement('div'), {
        className: 'stat-round',
        innerHTML: `
        <div class="round-info">
            <div class="round-number">Round <b>${data.actualRoundNumber}</b></div>
            <div class="round-time">Time elapsed <b>${data.timeElapsed}</b></div>
        </div>
        <div class="player-list">
            <div class="labels">
                <div class="pop-player-name">Player Name</div>
                <div class="player-cards-calc"># of Cards Played</div>
                <div class="player-cards-calc"># of Nertz Left</div>
                <div class="player-points">Points</div>
            </div>
        </div>
        `
    })

    const playerListCard = (data) => Object.assign(document.createElement('div'), {
        className: 'player-card',
        innerHTML: `
        <div class="pop-player-name">${data.playerName}</div>
        <div class="player-cards-calc">${data.cardsPlayed}</div>
        <div class="player-cards-nertz">${data.nertzLeft}</div>
        <div class="player-points">${data.score}</div>
        `
    })
    const leaderBoardCard = (data) => Object.assign(document.createElement('div'), {
        id: data.pid,
        className: 'lb-card',
        innerHTML: `
        <div class="pop-player-name">${data.playerName}</div>
        <div class="player-total-points" data-value="${data.totalPoints}">${data.totalPoints}pts</div>
        `
    })

    const {data, id, settings, ...rounds} = roomData;

    Object.values(rounds).forEach((round, index) => {
        const {data, ...playerIds} = round;
        
        let actualRoundNumber = index + 1;
        let container = roundContainer({
            actualRoundNumber,
            timeElapsed: data.timeElapsed
        });
        let playerList = container.children[1];

        Object.keys(playerIds).forEach(pid => {
            let playerEl = document.querySelector(`player[data-id="${pid}"]`);
            let playerSlotIndex = parseInt(playerEl.dataset.player.replace('PLAYER ', '') - 1)
            let playerSlot = document.querySelectorAll(`.player-slot`)[playerSlotIndex];

            let playerName = playerSlot.querySelector('.player-name').innerHTML.trim();

            let nertzLeft = (playerIds[pid].score - playerIds[pid].cardsPlayed) / -2;

            let card = playerListCard({
                playerName,
                score: playerIds[pid].score,
                cardsPlayed: playerIds[pid].cardsPlayed,
                nertzLeft
            });

            playerList.appendChild(card);

            let prevLeaderBoardCard = document.querySelector(`.lb-card[id="${pid}"]`)

            if (!prevLeaderBoardCard) {
                let totalPoints = playerIds[pid].score;
                let lbCard = leaderBoardCard({
                    playerName,
                    totalPoints,
                    pid
                });
    
                statPopup.querySelector('.leaderboard-list').appendChild(lbCard);
            } else {
                let prevTotal = prevLeaderBoardCard.children[1].dataset.value;
                let totalPoints = prevTotal + playerIds[pid].score;
                prevLeaderBoardCard.children[1].innerHTML = `${totalPoints}pts`;
                prevLeaderBoardCard.children[1].dataset.value = totalPoints;
            }
        });

        statPopup.appendChild(container)
    })
}

socket.on('player-stats', (data) => {
    console.log(`STATS from player ${data.id}`, data)
    // Doesnt show up for whoever calls testWin()
    // I guess it does now...
})
socket.on('next-round', (data) => {
    console.warn('NEXT ROUND DATA:', data);
    let roomData = data.roomData;
    populateStatPopup(roomData);

    showPopper();

    if (data.shouldEndMatch) {

        console.log('WOAH! Someone won...!!!', {
            roomData
        });

    } else {
        nextRoundPiles(data);
    }
})


// Join
const nonPartyLeaderStartButtonHandler = (e) => {
    let prevState = e.currentTarget.dataset.ready || 'false';
    if (prevState == 'false') {
        e.currentTarget.dataset.ready = true;
        socket.emit('send-ready-state', {
            id: socket.id,
            state: true,
        })
    } else {
        e.currentTarget.dataset.ready = false;
        socket.emit('send-ready-state', {
            id: socket.id,
            state: false,
        })
    }
}

socket.on('short-name', (n) => {
    window.shortName = n;
})

socket.on('join', (data) => {
    console.log('joined', data);

    // Load / populate game data
    let playerIds = data.players;
    let existingPlayerIds = [];

    document.querySelectorAll('player').forEach(p => {
        existingPlayerIds.push(p.dataset.id)
    })

    console.log('EXISTING players:', existingPlayerIds)

    if (playerIds.length > existingPlayerIds.length) {
        let newPlayerIds = playerIds.filter((id) => {
            return !existingPlayerIds.includes(id);
        })

        console.log('NEW players:', newPlayerIds)
        let num = existingPlayerIds.length + 1;

        let selfSocketIndex = newPlayerIds.indexOf(socket.id);
        if (selfSocketIndex >= 0) {
            // This means the user has joined a room themself.
            console.log('populating my area first!')
            let myPiles = populatePlayerPile(1, socket.id, (selfSocketIndex + 1));
            
            socket.emit('my-initial-piles', {
                workPile: myPiles[0].innerHTML,
                nertzPile: myPiles[1].innerHTML,
                id: socket.id
            })

            if (newPlayerIds.length > 1) {
                let slot;
                let alreadyOccupiedIndices = [];
                newPlayerIds.forEach((id, index) => {
                    if ((id != socket.id)) {
                        alreadyOccupiedIndices.push(index)
                    }
                });

                console.log(alreadyOccupiedIndices, socket.id);
                [...document.querySelectorAll('.player-slot')].every((s, i) => {
                    if (s.classList.contains('occupied') || alreadyOccupiedIndices.includes(i)) return true;
    
                    slot = s;
                    selfSocketIndex = i;
    
                    return false;
                })
    
                console.log(slot, 'mine')
                slot.classList.add('occupied');
                slot.classList.add('self');
                slot.dataset.ready = false;
                slot.querySelector('.player-name').innerHTML = window.shortName;
                slot.querySelector('.player-name').setAttribute('contenteditable', true);

                slot.querySelector('.player-name').onkeydown = (e) => {        
                    if (e.currentTarget.textContent.length > 17) { 
                        e.preventDefault();
                    }
        
                    slot.querySelector('.player-name').onkeyup = playerNameChangeKeyUpHandler;
                };
        
                slot.querySelector('.player-name').onpaste = function (e) {
                    e.preventDefault();
                };

                socket.emit('player-name-change', {
                    id: socket.id,
                    playerName: window.shortName
                });
                socket.emit('send-ready-state', {
                    id: socket.id,
                    state: false,
                })

                let partyCodeTopRight = document.getElementById('party-code-top-right');
                partyCodeTopRight.innerHTML = data.roomCode;
            }

            num++;
        } 

        newPlayerIds.forEach((id, i) => {
            if (i == selfSocketIndex) return;
            let actualNum = (existingPlayerIds.length + 1);
            if (selfSocketIndex >= 0) {
                actualNum = (i + 1);
            }
            console.log('populating', {
                num, id, actualNum
            })
            populatePlayerPile(num, id, actualNum);

            if (existingPlayerIds.includes(socket.id)) {
                let SELFplayerContainer = document.querySelector(`player[data-id="${socket.id}"]`);
                let SELFslotIndex = parseInt(SELFplayerContainer.dataset.player.replace('PLAYER ', '') - 1)
                let SELFslot = document.querySelectorAll(`.player-slot`)[SELFslotIndex];

                socket.emit('my-data', {
                    newPlayerIds: newPlayerIds,
                    workPile: SELFplayerContainer.children[0].innerHTML,
                    nertzPile: SELFplayerContainer.children[1].innerHTML,
                    foundations: document.querySelector(`.foundations`).innerHTML,
                    playerName: SELFslot.querySelector('.player-name').innerHTML,
                    recipientId: id,
                    senderId: socket.id,
                });
            }

            let slot = document.querySelectorAll('.player-slot')[actualNum - 1]
            console.log('changing slot', slot, 'to not-self')
            slot.classList.add(...['occupied', 'not-self'])

            num++;
        });

        populateFoundations(newPlayerIds.length, false);
        addDrag();
    }

    // Party management
    let gameField = document.getElementById('game-field');
    gameField.dataset.round = 1;

    if (gameField.classList.contains('hidden')) {
        console.log('WOAH! Game has not started!');

        if (existingPlayerIds.length == 0 && partyWrap.querySelector('.code-wrapper-container').classList.contains('joining')) {
            let requestGameData = getGameData(socket.id);

            partyWrap.querySelector('.code-value').classList.remove('hidden');
            partyWrap.querySelector('.code-value').innerHTML = partyWrap.querySelector('#code-input').value;

            partyWrap.querySelector('#code-input').classList.add('hidden');
            partyWrap.querySelector('.code-input-submit').classList.add('hidden');

            partyWrap.querySelector('.code-wrapper-container').classList.add('slow-transition')
            partyWrap.querySelector('.code-wrapper-container').classList.remove('joining');
            
            setTimeout(async () => {
                partyWrap.querySelector('.code-wrapper-container').classList.remove('slow-transition')
                
                waitingItems.forEach(w => {
                    console.log('adding', w)
                    if (!w.classList.contains('popper-wrapper')) {
                        w.classList.add('show');  
                    } 
                    if (w.classList.contains('game-settings')) {
                        w.classList.add('not-leader');
                    }
                });

                // Get game data
                let game = await requestGameData;
                console.log({ game })
                if (game && game.state == 'started') {
                    let menu = document.getElementById('menu');
                    let field = document.getElementById('game-field');
                    field.dataset.round = game.round;
                
                    countUpTimer.start({
                        startValues: {
                            seconds: (Date.now() - game.timeOfStart) / 1000
                        }
                    });
                
                    menu.classList.add('hide-animation');
                
                    setTimeout(() => {
                        menu.classList.add('hidden');
                        field.classList.remove('hidden');
                        startGameAnimation(field)
                    }, 520)
                }
            }, 800)

            partyWrap.querySelector('.start-button').classList.add('ready-up');
            partyWrap.querySelector('.start-button').onclick = nonPartyLeaderStartButtonHandler;
        }
    }
});

const getGameData = (sid) => {
    socket.emit('get-game-data');

    let request = new Promise((resolve) => {
        socket.on('send-game-data', (data) => {
            resolve(data)
        })
    });

    return request;
}

socket.on('player-name-change', (data) => {
    console.log('Recieved player name change:', data)

    let slotIndex = parseInt(document.querySelector(`player[data-id="${data.id}"]`).dataset.player.replace('PLAYER ', '') - 1)
    let slotToChange = document.querySelectorAll(`.player-slot`)[slotIndex];
    slotToChange.children[1].innerHTML = data.playerName;
});

socket.on('game-settings-change', (data) => {
    console.log('Recieved game settings change:', data)

    // Sliders
    if (data.pointsThreshold) {
        let pointsInput = document.querySelector('#points-input');
        let pointsDisplay = document.querySelector('.points-threshold-value');
        pointsInput.value = data.pointsThreshold;
        pointsDisplay.innerHTML = data.pointsThreshold;
    }
    if (data.roundsThreshold) {
        let roundsInput = document.querySelector('#rounds-input');
        let roundsDisplay = document.querySelector('.rounds-threshold-value');
        roundsInput.value = data.roundsThreshold;
        roundsDisplay.innerHTML = data.roundsThreshold;
    }

    // Checkboxes
    if (data.pointsChecked !== undefined) {
        let pointsCheckBox = document.querySelector('#points-checkox');
        pointsCheckBox.checked = data.pointsChecked;
    }
    if (data.roundsChecked !== undefined) {
        let roundsCheckBox = document.querySelector('#rounds-checkox')
        roundsCheckBox.checked = data.roundsChecked;
    }
});

socket.on('my-initial-piles', (data) => {
    console.log(`Recieved a new player's initial piles:`, data)

    let playerContainer = document.querySelector(`player[data-id="${data.id}"]`);
    let workPileContainer = playerContainer.querySelector('workpile');
    workPileContainer.innerHTML = data.workPile;

    let nertzPileContainer = playerContainer.querySelector('nertzpile');
    nertzPileContainer.innerHTML = data.nertzPile;

});

// Leave (disconnect)

socket.on('leave', (data) => {
    let playerContainer = document.querySelector(`player[data-id="${data.id}"]`);
    let slotIndex = [...document.querySelectorAll('player')].indexOf(playerContainer)
    playerContainer.remove();
    console.log('left', {data, playerContainer});

    let remainingIds = data.roomIds.slice();
    remainingIds.splice(data.roomIds.indexOf(data.id), 1);

    if (remainingIds.length > 0) {
        remainingIds.forEach((id, i) => {
            let playerContainer = document.querySelector(`player[data-id="${id}"]`);
            playerContainer.dataset.player = `PLAYER ${(i + 1)}`
        })
    }

    let slotToChange = document.querySelectorAll(`.player-slot`)[slotIndex];
    slotToChange.classList.remove(...['occupied', 'not-self'])
    slotToChange.children[1].innerHTML = '...';

    let gameField = document.getElementById('game-field')
    if (gameField.classList.contains('hidden')) {
        removeFoundations(1);
    } else {
        // If game is in progress
        removeFoundations(1, {
            safe: true
        });
    }
});


// Helpers / Handlers / Listener Assignments

const lowerCode = (code) => {
    let lower = code.replace(/[A-Z]/g, function(match) {
        return match.toLowerCase();
    });

    return lower;
}
const playerNameChangeKeyUpHandler = (e) => {
    socket.emit('player-name-change', {
        id: socket.id,
        playerName: e.currentTarget.textContent
    })
}
document.querySelectorAll('.waiting-area player-name').forEach(n => {
    n.addEventListener("keypress", (e) => {
        if(e.currentTarget.innerHTML.length >= 14){
            e.preventDefault();
        }
    });
})

// POPUP
const popper = document.querySelector('.popper-wrapper');
const closePopup = (e) => {
    e.currentTarget.innerHTML = 'open statistics'
    popper.classList.remove('show')
}
const showPopup = (e) => {
    e.currentTarget.innerHTML = 'close'
    popper.classList.add('show')
}
popper.querySelector('.close-popper').addEventListener('click', (e) => {
    if (e.currentTarget.innerHTML == 'open statistics') {
        console.log('showing')
        showPopup(e);
        return;
    }
    if (e.currentTarget.innerHTML == 'close') {
        console.log('closing')
        closePopup(e);
    }
})

const gameSettingsHandlers = () => {
    let pointsInput = document.querySelector('#points-input');
    let pointsDisplay = document.querySelector('.points-threshold-value');

    let roundsInput = document.querySelector('#rounds-input');
    let roundsDisplay = document.querySelector('.rounds-threshold-value');

    pointsInput.oninput = (e) => {
        pointsDisplay.innerHTML = e.currentTarget.value;
        socket.emit('game-settings-change', {
            pointsThreshold: e.currentTarget.value,
        })
    }
    roundsInput.oninput = (e) => {
        roundsDisplay.innerHTML = e.currentTarget.value;
        socket.emit('game-settings-change', {
            roundsThreshold: e.currentTarget.value,
        })
    }


    let pointsCheckBox = document.querySelector('#points-checkox');
    let roundsCheckBox = document.querySelector('#rounds-checkox')

    pointsCheckBox.oninput = (e) => {
        socket.emit('game-settings-change', {
            pointsChecked: e.currentTarget.checked,
        })
    }
    roundsCheckBox.oninput = (e) => {
        socket.emit('game-settings-change', {
            roundsChecked: e.currentTarget.checked,
        })
    }
}

const getLocalGameSettings = () => {
    console.warn('Unreliable action: retrieving local input values for settings.')
    // Sliders
    let pointsInput = document.querySelector('#points-input');
    let roundsInput = document.querySelector('#rounds-input');
    // Checkboxes
    let pointsCheckBox = document.querySelector('#points-checkox');
    let roundsCheckBox = document.querySelector('#rounds-checkox');

    let settings = {
        pointsThreshold: parseInt(pointsInput.value),
        roundsThreshold: parseInt(roundsInput.value),
        pointsChecked: pointsCheckBox.checked,
        roundsChecked: roundsCheckBox.checked,
    }

    return settings;
}

// Party Management

let menuItems = [...document.querySelector('.hero').children];
let waitingItems = [...document.querySelector('.waiting-area').children];
let partyWrap = document.querySelector('.waiting-area');


document.querySelector('.create-party-button').addEventListener('click', () => {
    console.log('creating party...')
    socket.emit('create-party');
});

document.querySelector('.join-party-button').addEventListener('click', () => {
    console.log('joining party...')
    
    menuItems.forEach(m => {
        m.classList.remove('show')
    })

    setTimeout(() => {
        document.querySelector('.hero').classList.add('hidden')
    }, 301)

    setTimeout(() => {
        partyWrap.classList.remove('hidden')
        partyWrap.querySelector('.code-value').classList.add('hidden');
        partyWrap.querySelector('#code-input').classList.remove('hidden');
        partyWrap.querySelector('.code-input-submit').classList.remove('hidden');
        partyWrap.querySelector('.code-wrapper-container').classList.add('joining');
    }, 302);

    setTimeout(() => {
        waitingItems[2].classList.add('show');
    }, 412)
});

document.querySelector('.code-input-submit').addEventListener('click', () => {
    let codeInput = partyWrap.querySelector('#code-input');

    let loweredCode = lowerCode(codeInput.value);
    socket.emit('join-party', {
        code: loweredCode
    });

    codeInput.value = loweredCode;
});

document.querySelector('#code-input').addEventListener('keydown', (e) => {
    e.currentTarget.classList.remove('invalid');

    if (e.currentTarget.value.length > 6) {
        e.preventDefault();
    }
});

socket.on('invalid-code', () => {
    let codeInput = document.querySelector('#code-input');
    codeInput.classList.add('invalid')
});


let fullRoomTimeout;
socket.on('full-room', () => {
    if (fullRoomTimeout) {
        clearTimeout(fullRoomTimeout);
    }
    let container = document.querySelector('.code-wrapper-container');
    container.classList.add('full-room');

    fullRoomTimeout = setTimeout(() => {
        container.classList.remove('full-room');
    }, 3000)
})

document.querySelector('.exit-button').addEventListener('click', () => {
    console.log('leaving party...')
    socket.emit('leave-party');

    waitingItems.forEach(w => {
        w.classList.remove('show');
    });

    setTimeout(() => {
        document.querySelector('.waiting-area').classList.add('hidden')
    }, 201)

    setTimeout(() => {
        document.querySelector('.hero').classList.remove('hidden');
    }, 202)

    setTimeout(() => {
        menuItems.forEach(m => {
            m.classList.add('show')
        })
    }, 212)

    let slots = document.querySelectorAll('.player-slot');
    slots.forEach(slot => {
        slot.children[1].innerHTML = '...';
        slot.classList.remove(...['occupied', 'not-self'])
    });

    document.querySelectorAll('player').forEach(p => {
        console.log(p)
        p.remove();
    })
});


const startGameAnimation = (field) => {
    setTimeout(() => {
        field.classList.add('show')
    }, 20);

    setTimeout(() => {
        field.classList.remove(...['hide', 'show']);

        let foundationSlots = document.querySelectorAll('.foundations > stack');
        foundationSlots.forEach((slot, i) => {
            slot.style.animation = `fadein 0.3s linear ${(i + 1) * 0.1}s 1 forwards`;
        }) 
    }, 720);
}

socket.on('send-ready-state', (data) => {
    console.log(`received ready state: ${data.state}`);

    let slotIndex = parseInt(document.querySelector(`player[data-id="${data.id}"]`).dataset.player.replace('PLAYER ', '') - 1)
    let slotToChange = document.querySelectorAll(`.player-slot`)[slotIndex];
    slotToChange.dataset.ready = data.state;

    const readyStates = [];
    document.querySelectorAll('.player-slot.occupied').forEach(slot => {
        readyStates.push(slot.dataset.ready);
    });
});

let explainStartButtonTimeout;

const partyLeaderStartButtonHandler =  (e) => {
    if (e.currentTarget.dataset.ready) return console.warn('not party leader!');

    let numOfPlayers = document.querySelectorAll('player').length;

    if (numOfPlayers < 2) {
        return console.log(`can't play with yourself :(`);
    } 

    const readyStates = [];
    document.querySelectorAll('.player-slot.occupied').forEach(slot => {
        readyStates.push(slot.dataset.ready);
    })

    console.log({ readyStates });

    if (readyStates.includes('false')) {
        if (explainStartButtonTimeout) {
            clearTimeout(explainStartButtonTimeout)
            document.querySelector('.start-button').classList.remove('explain');

            setTimeout(() => {
                document.querySelector('.start-button').classList.add('explain');
                explainStartButtonTimeout = setTimeout(() => {
                    document.querySelector('.start-button').classList.remove('explain');
                }, 3000)
            })
        } else {
            document.querySelector('.start-button').classList.add('explain');
            explainStartButtonTimeout = setTimeout(() => {
                document.querySelector('.start-button').classList.remove('explain');
            }, 3000)
        }

        return console.warn('player(s) not ready!')
    };

    console.log('starting game...');

    let menu = document.getElementById('menu');
    let field = document.getElementById('game-field');
    // Save game settings to database

    // Sliders
    let pointsInput = document.querySelector('#points-input');
    let roundsInput = document.querySelector('#rounds-input');
    // Checkboxes
    let pointsCheckBox = document.querySelector('#points-checkox');
    let roundsCheckBox = document.querySelector('#rounds-checkox');

    socket.emit('game-settings-change', {
        isStartingGame: true,
        pointsThreshold: parseInt(pointsInput.value),
        roundsThreshold: parseInt(roundsInput.value),
        pointsChecked: pointsCheckBox.checked,
        roundsChecked: roundsCheckBox.checked,
    })

    socket.emit('set-game-data', {
        state: 'started',
        timeOfStart: Date.now(),
        round: parseInt(field.dataset.round),
    })

    menu.classList.add('hide-animation');

    setTimeout(() => {
        menu.classList.add('hidden');
        field.classList.remove('hidden');
        startGameAnimation(field)
    }, 520)

    socket.emit('start-game');
    countUpTimer.start();

    return;
};

socket.on('start-game', () => {
    let menu = document.getElementById('menu');
    let field = document.getElementById('game-field');

    countUpTimer.start();

    menu.classList.add('hide-animation');

    setTimeout(() => {
        menu.classList.add('hidden');
        field.classList.remove('hidden');
        startGameAnimation(field)
    }, 520)


    // Set the states to false so that when the round ends, by default, they 
    // have to take action to be ready. The next round will not start
    // until they have chose to ready up again.
    socket.emit('send-ready-state', {
        id: socket.id,
        state: false,
    });

    document.querySelector('.start-button.ready-up').dataset.ready = false;
});

socket.on('create-party-success', (data) => {
    console.log('successfully created party', data);

    menuItems.forEach(m => {
        m.classList.remove('show')
    })

    setTimeout(() => {
        document.querySelector('.hero').classList.add('hidden')
    }, 301)

    setTimeout(() => {
        partyWrap.classList.remove('hidden')

        partyWrap.querySelector('.code-value').innerHTML = data.code;
    
        let firstSlot = partyWrap.querySelector('.player-one');
        firstSlot.classList.add(...['occupied', 'self']);
        firstSlot.dataset.ready = true;
        firstSlot.children[0].innerHTML = 'Player 1 (You)'
        firstSlot.children[1].innerHTML = data.shortName;
        firstSlot.children[1].setAttribute('contenteditable', true);

        firstSlot.children[1].onkeydown = (e) => {        
            if (e.currentTarget.textContent.length > 17) {
                firstSlot.children[1].onkeyup = null;
                e.preventDefault();
            }
            firstSlot.children[1].onkeyup = playerNameChangeKeyUpHandler;
        };


        firstSlot.children[1].onpaste = function (e) {
            e.preventDefault();
        };

        gameSettingsHandlers();

        partyWrap.querySelector('.player-two').dataset.ready = false;
        partyWrap.querySelector('.player-three').dataset.ready = false;

        document.querySelector('.start-button').classList.add('not-allowed');
        document.querySelector('.start-button').onclick = partyLeaderStartButtonHandler;
    }, 302);

    setTimeout(() => {
        waitingItems.forEach(w => {
            if (!w.classList.contains('popper-wrapper')) {
                w.classList.add('show');  
            } 
        })
    }, 312)


    console.log('CODE:', data.code)
    let partyCodeTopRight = document.getElementById('party-code-top-right');
    partyCodeTopRight.innerHTML = data.code;
});

// 

socket.on('my-data', (data) => {
    console.log(`got inital data from player ${data.senderId}`, data);

    let playerContainer = document.querySelector(`player[data-id="${data.senderId}"]`);
    let workPileContainer = playerContainer.querySelector('workpile');
    workPileContainer.innerHTML = data.workPile;

    let nertzPileContainer = playerContainer.querySelector('nertzpile');
    nertzPileContainer.innerHTML = data.nertzPile;

    document.querySelector(`.foundations`).innerHTML = data.foundations;
    populateFoundations(1, false);

    let slotIndex = parseInt(playerContainer.dataset.player.replace('PLAYER ', '') - 1)
    let slotToChange = document.querySelectorAll(`.player-slot`)[slotIndex];
    slotToChange.children[1].innerHTML = data.playerName;
    console.log(`changing player #${slotIndex + 1}'s name to:`, data.playerName)
})

// Work piles
socket.on('work-pile', (data) => {
    console.log('work pile movement:', data);

    let playerContainer = document.querySelector(`player[data-id="${data.sid}"]`);
    let workPileContainer = playerContainer.querySelector('workpile');
    workPileContainer.innerHTML = data.raw;
});

// Nertz pile
socket.on('nertz-pile', (data) => {
    console.log('received nertz pile:', {data});

    let playerContainer = document.querySelector(`player[data-id="${data.id}"]`);
    let nertzPileContainer = playerContainer.querySelector('nertzpile');
    nertzPileContainer.innerHTML = data.nertzPile;
});

// Foundations
socket.on('foundation-stack', (data) => {
    console.log('foundation change:', data);

    let foundationStacks = document.querySelectorAll(`.foundations > stack`);
    foundationStacks[data.stackIndex].innerHTML = data.raw;
});



// Scoring !!!

const getOwnScore = () => {
    let me = document.querySelector(`player[data-id="${socket.id}"]`);
    let cardsLeft = me.querySelectorAll('card').length;
    let cardsPlayed = 52 - cardsLeft;

    let numNertz = me.querySelectorAll('nertzpile card').length;

    let score = (numNertz * -2) + cardsPlayed;

    return [score, cardsPlayed];
}

socket.on('round-end', () => {
    countUpTimer.reset();
    countUpTimer.stop();
    
    let field = document.querySelector('#game-field')
    let currentRound = parseInt(field.dataset.round);

    let [score, cardsPlayed] = getOwnScore();

    socket.emit('round-data', {
        id: socket.id,
        round: currentRound,
        score: score,
        cardsPlayed: cardsPlayed
    })

    console.log('emitting my data', {
        id: socket.id,
        round: currentRound,
        score: score,
        cardsPlayed: cardsPlayed
    })

    field.dataset.round = currentRound + 1;

    // "GAME OVER" text
    let endWrap = document.querySelector('.end-cover');
    endWrap.classList.remove('hidden');
    let endText = document.querySelector('.end-text');
    endText.classList.remove('hidden');

    setTimeout(() => {
        endWrap.classList.remove('hide');
        setTimeout(() => {
            endText.classList.remove('hide');
        }, 500)
    }, 200)

    let menu = document.getElementById('menu');

    setTimeout(() => {
        field.classList.add('hide');
        menu.classList.remove('hidden');
    }, 3000)

    // Show lobby again
    setTimeout(() => {
        field.classList.add('hidden');
        menu.classList.remove('hide-animation');

        setTimeout(() => {
            endWrap.classList.add('hide');
            setTimeout(() => {
                endText.classList.add('hide');
                setTimeout(() => {
                    endWrap.classList.add('hidden');
                    endText.classList.add('hidden');
                }, 100)
            }, 300)
        }, 200)
    }, 3500)
})

const testWin = () => {
    let field = document.getElementById('game-field');
    socket.emit('win', {
        id: socket.id,
        timeElapsed: countUpTimer.getTotalTimeValues().seconds,
        round: parseInt(field.dataset.round),             
    })
}
global.testWin = testWin;

const testNextRound = () => {
    socket.emit('next-round')
}
global.testNextRound = testNextRound;
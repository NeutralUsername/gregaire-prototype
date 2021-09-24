var cors = require('cors')

const server = require ('http').Server(app);
var express = require ('express'),
    app = express (),
    port = process.env.PORT || 3000
server.listen(port, () => console.log(`Nodejs Server listening on port ${port}!`));

const io = require("socket.io")(server, {
    cors: {
      origin: "http://localhost:3000/",
      methods: ["GET", "POST"]
    }
  });
const { RateLimiterMemory } = require ('rate-limiter-flexible');
const rateLimiter = new RateLimiterMemory ({
    points: 1,
    duration: .1,
});
var db = require('./db.js');
db.tryCreateDB()

const pendingOnlineRooms = [];
const activeGames = [];

io.on ('connection', function (socket) {
    var clientActiveGames = activeGames.filter(xyz => xyz.props.redip === socket.handshake.address|| xyz.props.blackip === socket.handshake.address)
    if(clientActiveGames.length) {
        for(game of clientActiveGames) {
            if( ! game.props.red) {
                if(game.props.redip === socket.handshake.address ) {
                    game.props.red = socket.id
                    io.to (socket.id).emit ('startGameRES', { color : "red", id : game.props.id, initialState : prepareStateForClient(game.state)});
                    break
                }
            }
            if( ! game.props.black) {
                if(game.props.blackip === socket.handshake.address ) {
                    game.props.black = socket.id
                    io.to (socket.id).emit ('startGameRES', { color : "black", id : game.props.id, initialState : prepareStateForClient(game.state)});
                    break
                }
            }
        }
    }

    updateClientPendingRooms ()
    socket.on ('startAIgameREQ', async function (data) {
        try {
            await rateLimiter.consume (socket.handshake.address);
            startGame(socket.id, 'AI', data.options);
        }
        catch (rejRes) {
            console.log ("flood protection => startAIgameREQ");
        }
    });

    socket.on ('createOnlineRoomREQ', async function (data){
        try {
            await rateLimiter.consume (socket.handshake.address);
            removePendingRoom(socket.id);
            pendingOnlineRooms.push ({
                roomkey : socket.id,
                options : data.options
            });
            updateClientPendingRooms ();
        }        
        catch (rejRes) {
            console.log ("flood protection => new pending Room");
        }
    });

    socket.on ('joinOnlineRoomREQ', async function (data) {
        try {
            await rateLimiter.consume (socket.handshake.address);
            if (data.roomkey != socket.id)
                if (getPendingRoom (data.roomkey)) 
                    if (getPendingRoom (data.roomkey).options.roomPassword.length) 
                        socket.emit ('roomPasswordREQ', {roomkey : data.roomkey});
                    else 
                        startGame (data.roomkey, socket.id, getPendingRoom (data.roomkey).options );
        }    
        catch (rejRes) {
            console.log ("flood protection => join pending Room");
        }   
    });
  
    socket.on ('roomPasswordRES' , function ( data) {
        if(data.password != undefined)
            if (getPendingRoom (data.roomkey).options.roomPassword === data.password) 
                startGame (data.roomkey, socket.id, getPendingRoom (data.roomkey).options );
    })

    socket.on ('actionMoveREQ' , function ( data) {
        var game = activeGames.find(game => game.props.id === data.gameid)
        if(!game) return
        var actorcolor = socket.id ===game.props.red ? "red" : socket.id ===game.props.black ? 'black': ''
        var turncolor = game.state.turncolor
        var stackFrom = game.state.stacks[data.stackfrom]
        var movingCardData = stackFrom.cards[stackFrom.cards.length - 1 ]
        var stackTo =  game.state.stacks[data.stackto]
        var stackToLength = stackTo.cards.length
        var opponentcolor = socket.id === game.props.red ? "black" : socket.id ===game.props.black ? 'red': ''
        
        if(actorcolor != turncolor) return
        if( ! (data.stackfrom.includes("tableau") || data.stackfrom.includes("foundation") || data.stackfrom === actorcolor+"stock" || data.stackfrom === actorcolor+"malus") ) return
      
        if( !data.stackfrom.includes("tableau")  && data.stackto.includes('foundation') && movingCardData.value != 1) return
        if( !data.stackfrom.includes("tableau") && data.stackto === opponentcolor+"waste") return
        if( !data.stackfrom.includes("tableau") && data.stackto === opponentcolor+"malus") return
        
        if(game.state.stockflipped && data.stackfrom != actorcolor+"stock" && data.stackto != actorcolor+"waste") return  
        if(data.stackfrom.includes('foundation') && (data.stackto === opponentcolor+"malus" || data.stackto === opponentcolor+"waste")) return
        if(data.stackto === turncolor + 'stock' ) return 
        if(data.stackto === turncolor + 'malus' ) return 
        if(data.stackto === turncolor + 'waste' )
            if(data.stackfrom != turncolor+'stock') return 
        if(data.stackto === opponentcolor + 'stock' ) return 
        if(stackToLength){
            var stackToUppermostCard = stackTo.cards[stackToLength - 1 ]
            if(data.stackto === opponentcolor + 'malus' || data.stackto === opponentcolor + 'waste' )  
                if ( stackToUppermostCard.suit === movingCardData.suit ) {
                    if ( parseInt(stackToUppermostCard.value) != parseInt(movingCardData.value) + 1 )
                        if ( parseInt(stackToUppermostCard.value) != parseInt(movingCardData.value) - 1 ) return
                }
                else return
            if(data.stackto === opponentcolor + "malus")
                if(stackToLength > 28) return
            if(data.stackto.includes('foundation') ) 
                if ( stackToUppermostCard.suit != movingCardData.suit ) return
                else if ( stackToUppermostCard.value != movingCardData.value-1 ) return
            if(data.stackto.includes('tableau')) {
                if( (stackToUppermostCard.value -1 ) != movingCardData.value ) return
                if(movingCardData.suit === '♥' || movingCardData.suit === '♦') 
                    if(stackToUppermostCard.suit  === '♥' || stackToUppermostCard.suit  === '♦'  ) return
                if(movingCardData.suit === '♠' || movingCardData.suit === '♣')
                    if(stackToUppermostCard.suit  === '♠' || stackToUppermostCard.suit  === '♣' ) return
            }
        }
        else {
            if(data.stackto.includes('foundation') )
                if(movingCardData.value != 1) return 
            if(data.stackto === opponentcolor+'waste') return
        }
        // if(stackFrom.name.includes('foundation')) 
        //     if(game.state.turntableaumove) return
            
        //     else
        //         game.state.turntableaumove = true
        var movingCard = stackFrom.cards.pop()
        db.insertAction(game.props.id, movingCard.color, movingCard.suit, movingCard.value, data.stackto, game.state.redtimer, game.state.blacktimer, actorcolor, game.state.turn)
        stackTo.cards.push( movingCard )
        game.state.stockflipped = false
        game.state.abortrequest = false
        if(stackFrom.name === turncolor+'stock') {
            if( stackTo.name === turncolor+'waste') {
                if( ! game.state.stacks[opponentcolor+"stock"].cards.length) {
                    var wasteSize = game.state.stacks[opponentcolor+"waste"].cards.length
                    for(var i = 0 ; i< wasteSize; i++) {
                        var card = game.state.stacks[opponentcolor+"waste"].cards.pop()
                        card.faceup = 0
                        game.state.stacks[opponentcolor+"stock"].cards.push(card);
                    }
                    var clientOpponentStock = prepareStackForClient (game.state.stacks[opponentcolor+"stock"] )
                    var clientOpponentWaste = prepareStackForClient(game.state.stacks[opponentcolor+"waste"])
                    io.to(game.props.red).emit('actionMoveRES', {stacks : [clientOpponentStock ,clientOpponentWaste]})
                    if(game.props.black != 'AI')
                        io.to(game.props.black).emit('actionMoveRES', {stacks : [clientOpponentStock ,clientOpponentWaste]})
                }
                // game.state.turntableaumove = false
                game.state.turn++
                if(game.state.turncolor === 'red' ? game.state.blacktimer > 0 : game.state.redtimer > 0)
                    game.state.turncolor = game.state.turncolor === 'red' ? 'black' : 'red'
            }
            else
                if(!stackFrom.cards.length) {
                    var wasteSize = game.state.stacks[turncolor+"waste"].cards.length
                    for(var i = 0 ; i< wasteSize; i++) {
                        var card = game.state.stacks[turncolor+"waste"].cards.pop()
                        card.faceup = 0
                        game.state.stacks[turncolor+"stock"].cards.push(card);
                    }
                }
        }
        if(stackFrom.cards.length) 
            if (stackFrom.name != turncolor+'stock' )
                stackFrom.cards[stackFrom.cards.length-1].faceup = 1
        var clientStackFrom = prepareStackForClient(stackFrom)
        var clientStackTo = prepareStackForClient(stackTo)

        io.to(game.props.red).emit('actionMoveRES', {stacks : [clientStackFrom ,clientStackTo]})
        if(game.props.black != 'AI')
            io.to(game.props.black).emit('actionMoveRES', {stacks : [clientStackFrom ,clientStackTo]})
            
        if(stackFrom.name === actorcolor+"malus") 
            if(!stackFrom.cards.length) {
                endGame(game)
                io.to(game.props.red).emit('gameEndedRES', {result : actorcolor})
                if(game.props.black != 'AI')
                    io.to(game.props.black).emit('gameEndedRES', {result : actorcolor})
            }
    }) 

    socket.on ('actionFlipREQ' , function ( data) {
        var game = activeGames.find(game => game.props.id === data.gameid)
        if(!game) return
        var actorcolor = socket.id === game.props.red ? "red" : socket.id ===game.props.black ? 'black': ''
        var turncolor = game.state.turncolor 
        if(actorcolor != turncolor) return 
        if(!data.stack.includes(turncolor)) return
        if(!data.stack.includes('stock')) return
        
        game.state.abortrequest = false
        game.state.stockflipped = true
        var stack = game.state.stacks[data.stack]
        var stackUppermostCard = stack.cards[stack.cards.length-1]
        stackUppermostCard.faceup = 1;
        db.insertAction(game.props.id, stackUppermostCard.color, stackUppermostCard.suit, stackUppermostCard.value,  data.stack, game.state.redtimer, game.state.blacktimer, actorcolor, game.state.turn)
        var clientStack = prepareStackForClient(game.state.stacks[data.stack])
        io.to(game.props.red).emit('actionFlipRES', clientStack)
        if(game.props.black != 'AI')
            io.to(game.props.black).emit('actionFlipRES', clientStack)
    })
    socket.on ('abortREQ' , function ( data) {
        var game = activeGames.find(game => game.props.id === data.gameid)
        if(!game) return
        var actorcolor = socket.id ===game.props.red ? "red" : socket.id ===game.props.black ? 'black': ''
        var opponentcolor = actorcolor === 'red' ? 'black' : 'red'
        if(!game.state.abortrequest) {
            if(game.state.turncolor === actorcolor) {
                if(!game.state[opponentcolor+"timer"]) {
                    endGame(game)
                    var winner = game.state.stacks.redmalus.cards.length >  game.state.stacks.blackmalus.cards.length ?"black" : game.state.stacks.blackmalus.cards.length > game.state.stacks.redmalus.cards.length ? "red" : "draw"
                    io.to(game.props.red).emit('gameEndedRES', {result : winner})
                    if(game.props.black != 'AI')
                        io.to(game.props.black).emit('gameEndedRES', {result : winner})
                }
                else {
                    game.state.abortrequest = actorcolor
                    io.to(game.props.red).emit('updateAbortRES')
                    if(game.props.black != 'AI')
                        io.to(game.props.black).emit('updateAbortRES')
                }
            } 
        }
        else {
            if(game.state.abortrequest != actorcolor) {
                endGame(game)
                var winner = game.state.stacks.redmalus.cards.length >  game.state.stacks.blackmalus.cards.length ?"black" : game.state.stacks.blackmalus.cards.length > game.state.stacks.redmalus.cards.length ? "red" : "draw"
                io.to(game.props.red).emit('gameEndedRES', {result : winner})
                if(game.props.black != 'AI')
                    io.to(game.props.black).emit('gameEndedRES', {result : winner})
            }
        }
    })
    socket.on ('disconnect', function () {
        removePendingRoom (socket.id);
        var game = activeGames.find(game => game.props.red === socket.id || game.props.black === socket.id)
        if(game) {
            var color = socket.id === game.props.red ? 'red' :  'black' 
            game.props[color] = ""
        }
    });
});

async function startGame (red, black, options) {
    removePendingRoom (red);
    black != 'AI' ? removePendingRoom (black) : '';
    updateClientPendingRooms (); 
    for(var i = 0; i< 1; i++) {
        activeGames.push( game = await db.initGame (red, black, options, new Date() ));
        console.log(game.props.id)
    }
    game.props.redip = io.sockets.sockets.get(red).handshake.address
    game.props.blackip = io.sockets.sockets.get(black).handshake.address
    io.to (red).emit ('startGameRES', { color : 'red', id : game.props.id, initialState : prepareStateForClient(game.state)});
    if(black != 'AI') 
        io.to(black).emit ('startGameRES', {color : 'black', id : game.props.id, initialState : prepareStateForClient(game.state)}) ;
    game.playertimer = setInterval(timer(game),1000 );
}

function endGame (game) {
    if(game.playertimer)
        clearInterval(game.playertimer);
    activeGames.splice( activeGames.findIndex(x => x.props.id === game.props.id ) , 1 )
 }

function prepareStackForClient (stack) {
    var clientStack =  JSON.parse(JSON.stringify(stack));
    if( clientStack.cards.length> 0) {
        if(clientStack.type === "pile")
        clientStack.cards = [clientStack.cards.pop()]
        for(card of  clientStack.cards) {
            if(!card.faceup) {
                delete card.suit
                delete card.value
            }
            else
                delete card.color
        }
    }
    return clientStack
}

function prepareStateForClient (state) {
    var clientState = JSON.parse(JSON.stringify(state));
    Object.keys( clientState.stacks).map(stack=> {
        if( clientState.stacks[stack].cards.length> 0) {
            if(clientState.stacks[stack].type === "pile")
            clientState.stacks[stack].cards = [clientState.stacks[stack].cards.pop()]
            for(card of  clientState.stacks[stack].cards) {
                if(!card.faceup) {
                    delete card.suit
                    delete card.value
                }
                else
                    delete card.color
            }
        }
     })
    return clientState
 }

function timer (game) {
    return  () => {
        game.state[game.state.turncolor+'timer'] = (game.state[game.state.turncolor+'timer']*1000 - 1000)/1000
        io.to(game.props.red).emit ('updateTimerRES', { redtimer: game.state.redtimer, blacktimer : game.state.blacktimer });
        if(game.props.black != 'AI') 
            io.to(game.props.black).emit ('updateTimerRES', { redtimer: game.state.redtimer, blacktimer : game.state.blacktimer });
        if(!game.state[game.state.turncolor+"timer"]){
            var opponentcolor = game.state.turncolor === 'red' ? 'black' : 'red'
            if(game.state[opponentcolor+"timer"]) {
                var card = game.state.stacks[game.state.turncolor+"stock"].cards.pop()
                card.faceup = 1
                game.state.stacks[game.state.turncolor+"waste"].cards.push(card)
                io.to(game.props.red).emit('actionMoveRES', {stacks : [prepareStackForClient(game.state.stacks[game.state.turncolor+"stock"]) , prepareStackForClient(game.state.stacks[game.state.turncolor+"waste"])]})
                if(game.props.black != 'AI')
                  io.to(game.props.black).emit('actionMoveRES', {stacks : [prepareStackForClient(game.state.stacks[game.state.turncolor+"stock"]) , prepareStackForClient(game.state.stacks[game.state.turncolor+"waste"])]})
                db.insertAction(game.props.id, card.color, card.suit, card.value, game.state.turncolor+"stock",  game.state.redtimer, game.state.blacktimer, game.state.turncolor, game.state.turn)
                db.insertAction(game.props.id, card.color, card.suit, card.value, game.state.turncolor+"waste", game.state.redtimer, game.state.blacktimer, game.state.turncolor, game.state.turn)
                // game.state.turntableaumove = false
                game.state.turncolor = opponentcolor
            }
            else {
                var winner = game.state.stacks.redmalus.cards.length >  game.state.stacks.blackmalus.cards.length ?"black" : game.state.stacks.blackmalus.cards.length > game.state.stacks.redmalus.cards.length ? "red" : "draw"
                endGame(game)
                io.to(game.props.red).emit ('gameEndedRES', { result : winner});
                if(game.props.black != 'AI') 
                    io.to(game.props.black).emit ('gameEndedRES', { result : winner}); 
            }       
        }
    }
}

function removePendingRoom(roomkey)  {
    if (getPendingRoom (roomkey)) {
        pendingOnlineRooms.splice (pendingOnlineRooms.findIndex (e => e.roomkey == roomkey), 1);
        updateClientPendingRooms ();
    }
}

function getPendingRoom (roomkey) {
    if (pendingOnlineRooms.find (e => e.roomkey === roomkey) )
        return pendingOnlineRooms.find (e => e.roomkey === roomkey);
    else
        return false;
}

function updateClientPendingRooms () {
    io.sockets.emit ('UpdatePendingRoomsRES' , { pendingRooms : pendingOnlineRooms});
}

function AInextMove(game) {
    var turncolor = game.state.turncolor
    var playermalus = games.state.stacks[turncolor+"malus"]
    var malusUppermostCard = playermalus.cards[playermalus.cards.length-1]
    
    '♥'

    '♦'

    '♠' 

    '♣'
}

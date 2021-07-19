import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';


class Card {
    constructor(suit, value, set, faceUp) {
        this.suit = suit;
        this.value = value;
        this.faceUp = faceUp;
        this.set = set;
    }
}

class Sequence {
    constructor(cards) {
        this.sequence = cards;
    }
}

class Stack {
    constructor(cards) {
        this.stack = cards;
    }
}
class Deck  {
    constructor() {
        this.cards =  freshDeck();
    }
}

function freshDeck() {
    const Suits = ["♠", "♥", "♦", "♣"];
    const Values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
    const Sets = ["R", "B"];
    return Suits.map(suit => {
        return Values.map(value => {
            return Sets.map(set => {
                return new Card(suit, value, set, false)
            });
        });
    });
}
function shuffle(deck) {
    let currentIndex = deck.length,  randomIndex;
    while (0 !== currentIndex) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [deck[currentIndex], deck[randomIndex]] = [
            deck[randomIndex], deck[currentIndex]];
    }
    return deck;
}

class Board extends React.Component {
    render() {
        return (
            <div className="game">
                <div className="game-board">
                    <TicTacToeBoard />
                </div>
                <div className="game-info">
                    <div>{/* status */}</div>
                    <ol>{/* TODO */}</ol>
                </div>
            </div>
        );
    }
}
class Solitaire extends React.Component {
    render() {
        return (
            <div className="game">
                <div className="game-board">
                    <TicTacToeBoard />
                </div>
                <div className="game-info">
                    <div>{/* status */}</div>
                    <ol>{/* TODO */}</ol>
                </div>
            </div>
        );
    }
}

//======================================================================================================================



function Square(props) {
    return (
        <button className="square" onClick={props.onClick}>
            {props.value}
        </button>
    );
}

class TicTacToeBoard extends React.Component
{
    constructor(props)
    {
        super(props);
        this.state =
            {
                squares: Array(9).fill(null),
                xIsNext: true,
            };
    }
    handleClick(i) {
        const squares = this.state.squares.slice();
        if (calculateWinner(squares) || squares[i]) {
            return;
        }
        squares[i] = this.state.xIsNext ? 'X' : 'O';
        this.setState({
            squares: squares,
            xIsNext: !this.state.xIsNext,
        });
    }
    renderSquare(i)
    {
        return <Square value={this.state.squares[i]}  onClick={() => this.handleClick(i)} />;
    }
    render()
    {
        const winner = calculateWinner(this.state.squares);
        let status;
        if (winner) {
            status = 'Winner: ' + winner;
        } else {
            status = 'Next player: ' + (this.state.xIsNext ? 'X' : 'O');
        }
        return (
            <div>
                <div className="status">{status}</div>
                <div className="board-row">
                    {this.renderSquare(0)}
                    {this.renderSquare(1)}
                    {this.renderSquare(2)}
                </div>
                <div className="board-row">
                    {this.renderSquare(3)}
                    {this.renderSquare(4)}
                    {this.renderSquare(5)}
                </div>
                <div className="board-row">
                    {this.renderSquare(6)}
                    {this.renderSquare(7)}
                    {this.renderSquare(8)}
                </div>
            </div>
        );
    }
}

class TicTacToe extends React.Component {
    render() {
        return (
            <div className="game">
                <div className="game-board">
                    <TicTacToeBoard />
                </div>
                <div className="game-info">
                    <div>{/* status */}</div>
                    <ol>{/* TODO */}</ol>
                </div>
            </div>
        );
    }
}

// ========================================

ReactDOM.render(
    <TicTacToe />,
    document.getElementById('root')
);


function calculateWinner(squares) {
    const lines = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6],
    ];
    for (let i = 0; i < lines.length; i++) {
        const [a, b, c] = lines[i];
        if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
            return squares[a];
        }
    }
    return null;
}
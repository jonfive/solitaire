from flask import Flask, render_template, jsonify, request
import random

app = Flask(__name__)

class Card:
    def __init__(self, suit, value):
        self.suit = suit
        self.value = value
        self.face_up = False
        self.id = f"{value}_{suit}"

    def to_dict(self):
        return {
            'suit': self.suit,
            'value': self.value,
            'face_up': self.face_up,
            'id': self.id
        }

class Solitaire:
    def __init__(self):
        self.reset_game()

    def reset_game(self):
        self.score = 0
        self.deck = []
        suits = ['hearts', 'diamonds', 'clubs', 'spades']
        values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
        
        for suit in suits:
            for value in values:
                self.deck.append(Card(suit, value))
        
        random.shuffle(self.deck)
        
        self.tableau = [[] for _ in range(7)]
        self.foundations = [[] for _ in range(4)]
        self.waste = []
        self.stock = []
        
        # Deal cards to tableau
        for i in range(7):
            for j in range(i, 7):
                card = self.deck.pop()
                if i == j:  # Top card in each pile
                    card.face_up = True
                self.tableau[j].append(card)
        
        # Remaining cards go to stock
        self.stock = self.deck
        for card in self.stock:
            card.face_up = False

    def get_game_state(self):
        return {
            'score': self.score,
            'tableau': [[card.to_dict() for card in pile] for pile in self.tableau],
            'foundations': [[card.to_dict() for card in pile] for pile in self.foundations],
            'waste': [card.to_dict() for card in self.waste],
            'stock': [card.to_dict() for card in self.stock]
        }

    def draw_card(self):
        if not self.stock:
            self.stock = list(reversed(self.waste))
            self.waste = []
            for card in self.stock:
                card.face_up = False
            return True
            
        card = self.stock.pop()
        card.face_up = True
        self.waste.append(card)
        return True

    def can_place_on_foundation(self, card, foundation):
        if not foundation:
            return card.value == 'A'
        top_card = foundation[-1]
        values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
        return (card.suit == top_card.suit and 
                values.index(card.value) == values.index(top_card.value) + 1)

    def can_place_on_tableau(self, card, tableau_pile):
        if not tableau_pile:
            return card.value == 'K'
        top_card = tableau_pile[-1]
        if not top_card.face_up:
            return False
        values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
        red_suits = ['hearts', 'diamonds']
        return ((card.suit in red_suits) != (top_card.suit in red_suits) and 
                values.index(card.value) == values.index(top_card.value) - 1)

    def move_card(self, from_type, from_index, to_type, to_index, card_index=None):
        # Get source pile
        if from_type == 'tableau':
            source = self.tableau[from_index]
            if card_index is None:
                card_index = len(source) - 1
            cards_to_move = source[card_index:]
            source_card = source[card_index]
        elif from_type == 'waste':
            if not self.waste:
                return False
            source = self.waste
            source_card = source[-1]
            cards_to_move = [source_card]
        elif from_type == 'foundation':
            if not self.foundations[from_index]:
                return False
            source = self.foundations[from_index]
            source_card = source[-1]
            cards_to_move = [source_card]
        else:
            return False

        if not source_card.face_up:
            return False

        # Get destination pile
        if to_type == 'tableau':
            dest = self.tableau[to_index]
            if not self.can_place_on_tableau(source_card, dest):
                return False
        elif to_type == 'foundation':
            dest = self.foundations[to_index]
            if not self.can_place_on_foundation(source_card, dest):
                return False
            if len(cards_to_move) > 1:  # Can only move one card at a time to foundation
                return False
        else:
            return False

        # Move cards
        for _ in range(len(cards_to_move)):
            dest.append(source.pop())

        # Flip new top card in tableau if needed
        if from_type == 'tableau' and source and not source[-1].face_up:
            source[-1].face_up = True
            self.score += 5

        # Update score
        if to_type == 'foundation':
            self.score += 10
        elif from_type == 'foundation':
            self.score -= 10

        return True

    def check_win(self):
        return all(len(pile) == 13 for pile in self.foundations)

game = Solitaire()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/new-game', methods=['POST'])
def new_game():
    game.reset_game()
    return jsonify(game.get_game_state())

@app.route('/api/game-state')
def get_game_state():
    return jsonify(game.get_game_state())

@app.route('/api/draw-card', methods=['POST'])
def draw_card():
    game.draw_card()
    return jsonify(game.get_game_state())

@app.route('/api/move-card', methods=['POST'])
def move_card():
    data = request.json
    success = game.move_card(
        data['fromType'],
        data['fromIndex'],
        data['toType'],
        data['toIndex'],
        data.get('cardIndex')
    )
    response = game.get_game_state()
    response['success'] = success
    response['won'] = game.check_win()
    return jsonify(response)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
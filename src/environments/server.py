import os
import sqlite3
from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify, app
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
from utils import *

app = Flask(__name__)
CORS(app, supports_credentials=True)
secret_key = os.urandom(24)
app.secret_key = secret_key
session= {}

roles = {
    'admin': 1,
    'manager': 2,
    'customer': 3
}

#! USER LOGIN (OK)
@app.route('/api/login', methods=['POST'])
def login():
    if request.method == 'POST':
        data = request.get_json()
        print("Dati ricevuti:", data)  # Log dei dati ricevuti
        username = data.get('username')
        password = data.get('password')
        if not username or not password:
            return jsonify({'error': 'Tutti i campi sono obbligatori!'}), 400
        conn = get_db_connection()
        user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
        conn.close()
        if user and check_password_hash(user['password'], password):
            session['user_id'] = user['id']
            session['username'] = user['username']
            session['role'] = user['role']
            return jsonify({
                'message': 'Login effettuato con successo',
                'user': {
                    'id': user['id'],
                    'username': user['username'],
                    'role': user['role']
                }
            })
        else:
            return jsonify({'error': 'Password o username errati!'}), 401
        
#! USER REGISTER (OK)
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    role = data.get('role')
    email = data.get('email')
    
    if not username or not password or not role or not email:
        return jsonify({'error': 'Tutti i campi sono obbligatori!'}), 400
    
    conn = get_db_connection()
    try:
        conn.execute('INSERT INTO users (username, password, role, email) VALUES (?, ?, ?, ?)',
                     (username, generate_password_hash(password), role, email))
        conn.commit()
        conn.close()
        return jsonify({'message': 'Registrato con successo!'}), 200
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Username già presente!'}), 400

# GET OFFERTE IN UN SUPERMERCATO SPECIFICO (ID)
@app.route('/offers/<int:supermarket_id>', methods=['GET'])
def view_offers(supermarket_id):
    if 'user_id' not in session:
        return jsonify({
            'status': 'error',
            'code': 'UNAUTHORIZED',
            'message': 'Autenticazione richiesta'
        }), 401
    
    conn = get_db_connection()
    try:
        # Verifica esistenza supermercato
        supermarket = conn.execute(
            'SELECT * FROM supermarkets WHERE id = ?', 
            (supermarket_id,)
        ).fetchone()
        
        if not supermarket:
            return jsonify({
                'status': 'error',
                'code': 'NOT_FOUND',
                'message': 'Supermercato non trovato'
            }), 404
        
        # Ottieni offerte attive
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        offers = conn.execute('''
            SELECT o.*, p.name as product_name, p.description as product_description, p.barcode as product_barcode, p.category as product_category,
                   ROUND((1 - o.offer_price/o.original_price) * 100, 1) as discount_percent
            FROM offers o
            JOIN products p ON o.product_id = p.id
            WHERE o.supermarket_id = ? 
            AND (o.end_date IS NULL OR o.end_date >= ?)
            ORDER BY discount_percent DESC
        ''', (supermarket_id, current_time)).fetchall()
        
        return jsonify({
            'status': 'success',
            'data': {
                'supermarket': dict(supermarket),
                'offers': [dict(offer) for offer in offers],
                'meta': {
                    'offer_count': len(offers),
                    'timestamp': current_time
                }
            }
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'code': 'SERVER_ERROR',
            'message': 'Errore nel recupero delle offerte',
            'details': str(e)
        }), 500
    finally:
        conn.close()

# GET DASHBOARD
@app.route('/dashboard', methods=['GET'])
def dashboard():
    if 'user_id' not in session:
        return jsonify({
            'status': 'error',
            'code': 'UNAUTHORIZED',
            'message': 'Autenticazione richiesta'
        }), 401
    
    conn = get_db_connection()
    try:
        role = session['role']
        response_data = {
            'status': 'success',
            'data': {
                'user': {
                    'id': session['user_id'],
                    'role': role
                }
            }
        }
        
        # Dati per admin
        if role == 'admin':
            supermarkets = conn.execute('SELECT * FROM supermarkets').fetchall()
            users = conn.execute('SELECT id, username, email, role FROM users').fetchall()
            products = conn.execute('SELECT * FROM products').fetchall()
            
            response_data['data'].update({
                'supermarkets': [dict(s) for s in supermarkets],
                'users': [dict(u) for u in users],
                'products': [dict(p) for p in products],
                'stats': {
                    'supermarket_count': len(supermarkets),
                    'user_count': len(users),
                    'product_count': len(products)
                }
            })
            
        # Dati per manager
        elif role == 'manager':
            supermarkets = conn.execute(
                'SELECT * FROM supermarkets WHERE manager_id = ?', 
                (session['user_id'],)
            ).fetchall()
            products = conn.execute('SELECT * FROM products').fetchall()
            
            response_data['data'].update({
                'supermarkets': [dict(s) for s in supermarkets],
                'products': [dict(p) for p in products],
                'stats': {
                    'managed_supermarkets': len(supermarkets),
                    'available_products': len(products)
                }
            })
            
        # Dati per customer
        else:  
            supermarkets = conn.execute('''
                SELECT s.*, 
                (SELECT COUNT(*) FROM offers o 
                 WHERE o.supermarket_id = s.id 
                 AND (o.end_date IS NULL OR o.end_date >= datetime('now'))) 
                as active_offers
                FROM supermarkets s
            ''').fetchall()
            
            response_data['data'].update({
                'supermarkets': [dict(s) for s in supermarkets],
                'stats': {
                    'supermarkets_with_offers': sum(1 for s in supermarkets if s['active_offers'] > 0)
                }
            })
        
        return jsonify(response_data)
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'code': 'SERVER_ERROR',
            'message': 'Errore nel recupero dei dati del dashboard',
            'details': str(e)
        }), 500
    finally:
        conn.close()
    
#? GET A SPECIFIC SUPERMERCATO (OK)
@app.route('/api/supermarkets/<int:supermarket_id>', methods=['GET'])
def view_supermarket(supermarket_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    conn = get_db_connection()
    
    supermarket = conn.execute('SELECT * FROM supermarkets WHERE id = ?', (supermarket_id,)).fetchone()
    
    products = conn.execute('''
    SELECT p.id, p.name, p.description, p.category, p.barcode, sp.price, sp.quantity, sp.on_offer, sp.offer_price
    FROM supermarket_products sp
    JOIN products p ON sp.product_id = p.id
    WHERE sp.supermarket_id = ?
    ''', (supermarket_id,)).fetchall()
    
    conn.close()
    
    return jsonify({
        'supermarket': dict(supermarket) if supermarket else None,
    })

#? GET TUTTI I SUPERMERCATI (OK)
@app.route('/api/supermarkets', methods=['GET'])
def view_supermarkets():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db_connection()
    supermarkets = conn.execute('SELECT * FROM supermarkets').fetchall()
    conn.close()
    return jsonify({
        'supermarkets': [dict(s) for s in supermarkets]
    })


#? GET ALL PRODUCTS FROM SPECIFIC SUPERMERCATO (OK)
@app.route('/api/supermarkets/<int:supermarket_id>/products', methods=['GET'])
def view_supermarket_products(supermarket_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    conn = get_db_connection()
    
    supermarket = conn.execute('SELECT * FROM supermarkets WHERE id = ?', (supermarket_id,)).fetchone()
    
    products = conn.execute('''
    SELECT p.id, p.name, p.description, p.category, p.barcode, sp.price, sp.quantity, sp.on_offer, sp.offer_price
    FROM supermarket_products sp
    JOIN products p ON sp.product_id = p.id
    WHERE sp.supermarket_id = ?
    ''', (supermarket_id,)).fetchall()
    
    conn.close()
    
    return jsonify({
        'products': [dict(p) for p in products]
    })


#? CREARE UN NUOVO SUPERMERCATO (OK)
@app.route('/api/add_supermarket', methods=['GET', 'POST'])
def add_supermarket():
    if 'user_id' not in session or session['role'] not in ['admin', 'manager']:
       return jsonify({'error': 'Unauthorized'}), 401
    if request.method == 'POST':
        
        data = request.get_json()
        print("Dati ricevuti:", data)  # Log dei dati ricevuti
            
        if not data:
            return jsonify({'error': 'Nessun dato fornito'}), 400
        
        try:
            name = data.get('name')
            address = data.get('address')
            latitude = float(data.get('latitude'))
            longitude = float(data.get('longitude'))
            manager_id = data.get('manager_id') if data.get('manager_id') else None
            
            conn = get_db_connection()
            conn.execute('INSERT INTO supermarkets (name, address, latitude, longitude, manager_id) VALUES (?, ?, ?, ?, ?)',
                        (name, address, latitude, longitude, manager_id))
            conn.commit()
            conn.close()
            return jsonify({'message': 'Supermercato aggiunto con successo!'})
        except sqlite3.IntegrityError as e:
            conn.close()
            print("Errore di integrità:", str(e))  # Log dell'errore specifico
            return jsonify({'error': 'Supermercato già esistente o manager_id non valido'}), 400
        except Exception as e:
            print("Errore generico:", str(e))  # Log di altri errori
            return jsonify({'error': 'Errore del server'}), 500
    
    # # Solo admin può assegnare manager
    # if session['role'] == 'admin':
    #     conn = get_db_connection()
    #     managers = conn.execute('SELECT * FROM users WHERE role = "manager"').fetchall()
    #     conn.close()
    # else:
    #     managers = None


#? AGGIUNGERE UN PRODOTTO (OK)
@app.route('/api/add_product', methods=['POST'])
def add_product():
    if 'user_id' not in session or session['role'] not in ['admin', 'manager']:
        return jsonify({'error': 'Unauthorized'}), 401
    
    if request.method == 'POST':
        data = request.get_json()
        name = data.get('name')
        description = data.get('description')
        category = data.get('category')
        barcode = data.get('barcode')
        
        if name == "":
            return jsonify({'error': 'Il nome del prodotto è obbligatorio!'}), 400
        
        conn = get_db_connection()
        try:
            conn.execute('INSERT INTO products (name, description, category, barcode) VALUES (?, ?, ?, ?)',
                        (name, description, category, barcode))
            conn.commit()
            conn.close()
        except sqlite3.IntegrityError:
            conn.close()
            return jsonify({'error': 'Prodotto già esistente!'}), 400
    return jsonify({'message': 'Prodotto aggiunto con successo!'}), 200    

from flask import jsonify

@app.route('/add_product_to_supermarket/<int:supermarket_id>', methods=['POST'])
def add_product_to_supermarket(supermarket_id):
    if 'user_id' not in session or session['role'] not in ['admin', 'manager']:
        return jsonify({'error': 'Unauthorized', 'message': 'Accesso negato'}), 401
    
    # Verifica permessi per manager
    if session['role'] == 'manager':
        conn = get_db_connection()
        manager_supermarkets = conn.execute('SELECT id FROM supermarkets WHERE manager_id = ?', (session['user_id'],)).fetchall()
        manager_supermarkets_ids = [s['id'] for s in manager_supermarkets]
        conn.close()
        
        if supermarket_id not in manager_supermarkets_ids:
            return jsonify({'error': 'Forbidden', 'message': 'Non hai i permessi per questo supermercato'}), 403
    
    if not request.is_json:
        return jsonify({'error': 'Bad Request', 'message': 'Richiesta deve essere JSON'}), 400
    
    data = request.get_json()
    try:
        product_id = data['product_id']
        price = float(data['price'])
        quantity = int(data['quantity'])
    except (KeyError, ValueError):
        return jsonify({'error': 'Bad Request', 'message': 'Dati mancanti o non validi'}), 400
    
    conn = get_db_connection()
    try:
        conn.execute('''
        INSERT INTO supermarket_products (supermarket_id, product_id, price, quantity)
        VALUES (?, ?, ?, ?)
        ''', (supermarket_id, product_id, price, quantity))
        conn.commit()
        return jsonify({
            'message': 'Prodotto aggiunto con successo',
            'data': {
                'supermarket_id': supermarket_id,
                'product_id': product_id,
                'price': price,
                'quantity': quantity
            }
        }), 201
    except sqlite3.IntegrityError:
        return jsonify({
            'error': 'Conflict', 
            'message': 'Prodotto già presente nel supermercato'
        }), 409
    except Exception as e:
        return jsonify({
            'error': 'Internal Server Error',
            'message': str(e)
        }), 500
    finally:
        conn.close()

@app.route('/generate_offers/<int:supermarket_id>', methods=['POST'])
def generate_offers(supermarket_id):
    if 'user_id' not in session or session['role'] not in ['admin', 'manager']:
        return jsonify({'error': 'Unauthorized', 'message': 'Accesso negato'}), 401
    
    # Verifica permessi per manager
    if session['role'] == 'manager':
        conn = get_db_connection()
        manager_supermarkets = conn.execute('SELECT id FROM supermarkets WHERE manager_id = ?', (session['user_id'],)).fetchall()
        manager_supermarkets_ids = [s['id'] for s in manager_supermarkets]
        conn.close()
        
        if supermarket_id not in manager_supermarkets_ids:
            return jsonify({'error': 'Forbidden', 'message': 'Permessi insufficienti'}), 403
    
    try:
        generate_random_offers(supermarket_id)
        return jsonify({
            'message': 'Offerte generate con successo',
            'supermarket_id': supermarket_id
        }), 200
    except Exception as e:
        return jsonify({
            'error': 'Internal Server Error',
            'message': str(e)
        }), 500

@app.route('/purchase/<int:supermarket_id>/<int:product_id>', methods=['POST'])
def purchase_product(supermarket_id, product_id):
    if 'user_id' not in session or session['role'] != 'customer':
        return jsonify({'error': 'Unauthorized', 'message': 'Accesso riservato ai clienti'}), 401
    
    if not request.is_json:
        return jsonify({'error': 'Bad Request', 'message': 'Richiesta deve essere JSON'}), 400
    
    data = request.get_json()
    try:
        quantity = int(data['quantity'])
    except (KeyError, ValueError):
        return jsonify({'error': 'Bad Request', 'message': 'Quantità mancante o non valida'}), 400
    
    conn = get_db_connection()
    try:
        product_info = conn.execute('''
        SELECT sp.price, sp.quantity, sp.on_offer, sp.offer_price, p.name,
               o.offer_price as active_offer_price, o.id as offer_id
        FROM supermarket_products sp
        JOIN products p ON sp.product_id = p.id
        LEFT JOIN offers o ON sp.supermarket_id = o.supermarket_id 
                          AND sp.product_id = o.product_id 
                          AND (o.end_date IS NULL OR o.end_date >= datetime('now'))
        WHERE sp.supermarket_id = ? AND sp.product_id = ?
        ORDER BY o.offer_price ASC
        LIMIT 1
        ''', (supermarket_id, product_id)).fetchone()
        
        if not product_info:
            return jsonify({'error': 'Not Found', 'message': 'Prodotto non trovato'}), 404
        
        if quantity > product_info['quantity']:
            return jsonify({
                'error': 'Bad Request',
                'message': 'Quantità non disponibile',
                'available_quantity': product_info['quantity']
            }), 400
        
        # Calcola prezzo
        if product_info['active_offer_price']:
            price_per_unit = product_info['active_offer_price']
            on_offer = 1
        else:
            price_per_unit = product_info['price']
            on_offer = 0
        
        total_price = round(price_per_unit * quantity, 2)
        
        # Registra acquisto
        conn.execute('''
        INSERT INTO purchases (user_id, supermarket_id, product_id, quantity, price_per_unit, total_price, on_offer)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (session['user_id'], supermarket_id, product_id, quantity, price_per_unit, total_price, on_offer))
        
        # Aggiorna quantità
        conn.execute('''
        UPDATE supermarket_products
        SET quantity = quantity - ?
        WHERE supermarket_id = ? AND product_id = ?
        ''', (quantity, supermarket_id, product_id))
        
        conn.commit()
        
        return jsonify({
            'message': 'Acquisto completato',
            'data': {
                'product_id': product_id,
                'product_name': product_info['name'],
                'quantity': quantity,
                'price_per_unit': price_per_unit,
                'total_price': total_price,
                'on_offer': bool(on_offer)
            }
        }), 201
    except Exception as e:
        conn.rollback()
        return jsonify({
            'error': 'Internal Server Error',
            'message': str(e)
        }), 500
    finally:
        conn.close()
        
#? Cronologia acquisti (OK)
@app.route('/api/purchases', methods=['GET'])
def purchase_history():
    if 'user_id' not in session or session['role'] != 'customer':
        return jsonify({'error': 'Unauthorized'}), 401
    
    conn = get_db_connection()
    purchases = conn.execute('''
    SELECT p.*, s.name as supermarket_name, pr.name as product_name, pr.barcode as product_barcode
    FROM purchases p
    JOIN supermarkets s ON p.supermarket_id = s.id
    JOIN products pr ON p.product_id = pr.id
    WHERE p.user_id = ?
    ORDER BY p.purchase_date DESC
    ''', (session['user_id'],)).fetchall()
    conn.close()
    
    return jsonify({
        'purchases': [dict(p) for p in purchases]
    }), 200

def generate_random_offers(supermarket_id, num_offers=3, discount_range=(10, 30), days_duration=7):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Disattiva offerte precedenti impostando una end_date
    current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    cursor.execute('''
    UPDATE offers 
    SET end_date = ?
    WHERE supermarket_id = ? AND end_date IS NULL
    ''', (current_time, supermarket_id))
    
    # Seleziona prodotti casuali
    cursor.execute('''
    SELECT sp.product_id, sp.price, p.name
    FROM supermarket_products sp
    JOIN products p ON sp.product_id = p.id
    WHERE sp.supermarket_id = ? 
    ORDER BY RANDOM() 
    LIMIT ?
    ''', (supermarket_id, num_offers))
    
    products = cursor.fetchall()
    
    # Crea nuove offerte
    for product in products:
        product_id = product['product_id']
        original_price = product['price']
        discount_percent = random.randint(*discount_range)
        offer_price = round(original_price * (1 - discount_percent/100), 2)
        
        end_date = (datetime.now() + timedelta(days=days_duration)).strftime('%Y-%m-%d %H:%M:%S')
        
        cursor.execute('''
        INSERT INTO offers (supermarket_id, product_id, original_price, offer_price, end_date, description)
        VALUES (?, ?, ?, ?, ?, ?)
        ''', (supermarket_id, product_id, original_price, offer_price, end_date, 
             f"Offerta speciale: {discount_percent}% di sconto"))
    
    conn.commit()
    conn.close()



if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True, port=5000)
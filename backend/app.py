from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import time
import string
import threading

app = Flask(__name__)
app.config['SECRET_KEY'] = 'password_cracker_secret_2024'
CORS(app, origins=["http://localhost:3000", "http://127.0.0.1:3000"])
socketio = SocketIO(app, cors_allowed_origins=["http://localhost:3000", "http://127.0.0.1:3000"], async_mode='threading')

# Active cracking sessions
active_sessions = {}

def get_charset(options):
    charset = ""
    if options.get('lowercase', True):
        charset += string.ascii_lowercase
    if options.get('uppercase', False):
        charset += string.ascii_uppercase
    if options.get('digits', False):
        charset += string.digits
    if options.get('symbols', False):
        charset += string.punctuation
    return charset or string.ascii_lowercase

def calculate_complexity(charset_size, password_length):
    total = sum(charset_size ** i for i in range(1, password_length + 1))
    return total

def backtracking_crack(target_password, charset, session_id, max_length=None):
    """
    Backtracking-based password cracking.
    Builds candidate strings character by character and backtracks
    when the partial string cannot match the target.
    """
    if max_length is None:
        max_length = len(target_password)
    
    attempts = 0
    start_time = time.time()
    found = False
    session = active_sessions.get(session_id, {})
    
    def emit_progress(current_attempt, attempt_count, elapsed, found_pw=None):
        socketio.emit('progress', {
            'session_id': session_id,
            'current_attempt': current_attempt,
            'attempts': attempt_count,
            'elapsed': round(elapsed, 4),
            'found': found_pw is not None,
            'password': found_pw
        })

    def backtrack(current, depth):
        nonlocal attempts, found
        
        if not active_sessions.get(session_id, {}).get('running', False):
            return None
        
        # Check if current matches target
        if current == target_password:
            found = True
            elapsed = time.time() - start_time
            emit_progress(current, attempts, elapsed, current)
            return current
        
        # Prune: if current length already equals max_length and didn't match
        if len(current) >= max_length:
            return None
        
        # Prune: if current != start of target (optional strict mode)
        # This simulates smart backtracking
        if len(current) < len(target_password):
            if target_password[:len(current)] != current and len(current) > 0:
                # In real brute-force we can't prune this way, but we simulate backtracking
                # by showing the attempt and continuing
                pass
        
        # Try each character in charset
        for char in charset:
            if not active_sessions.get(session_id, {}).get('running', False):
                return None
            
            next_candidate = current + char
            attempts += 1
            
            elapsed = time.time() - start_time
            
            # Emit progress every 100 attempts or for short passwords
            if attempts % max(1, min(100, len(target_password) * 10)) == 0 or len(target_password) <= 4:
                emit_progress(next_candidate, attempts, elapsed)
            
            result = backtrack(next_candidate, depth + 1)
            if result is not None:
                return result
        
        return None
    
    result = backtrack("", 0)
    elapsed = time.time() - start_time
    
    if session_id in active_sessions:
        active_sessions[session_id]['running'] = False
    
    if not found:
        socketio.emit('complete', {
            'session_id': session_id,
            'found': False,
            'attempts': attempts,
            'elapsed': round(elapsed, 4),
            'message': 'Password not found within constraints'
        })
    else:
        socketio.emit('complete', {
            'session_id': session_id,
            'found': True,
            'password': target_password,
            'attempts': attempts,
            'elapsed': round(elapsed, 4),
            'message': f'Password cracked successfully!'
        })


def iterative_backtrack_crack(target_password, charset, session_id):
    """
    Iterative version using explicit stack for backtracking visualization.
    More memory-efficient for longer passwords.
    """
    attempts = 0
    start_time = time.time()
    max_len = len(target_password)
    
    # Stack holds (current_string, char_index_in_charset)
    stack = [("", 0)]
    
    while stack:
        if not active_sessions.get(session_id, {}).get('running', False):
            break
        
        current, char_idx = stack[-1]
        
        if char_idx >= len(charset):
            stack.pop()
            continue
        
        # Update char index for current stack frame
        stack[-1] = (current, char_idx + 1)
        
        next_candidate = current + charset[char_idx]
        attempts += 1
        elapsed = time.time() - start_time
        
        if attempts % max(1, min(200, max_len * 20)) == 0 or max_len <= 3:
            socketio.emit('progress', {
                'session_id': session_id,
                'current_attempt': next_candidate,
                'attempts': attempts,
                'elapsed': round(elapsed, 4),
                'found': False,
                'stack_depth': len(stack)
            })
        
        if next_candidate == target_password:
            elapsed = time.time() - start_time
            if session_id in active_sessions:
                active_sessions[session_id]['running'] = False
            socketio.emit('progress', {
                'session_id': session_id,
                'current_attempt': next_candidate,
                'attempts': attempts,
                'elapsed': round(elapsed, 4),
                'found': True,
                'password': next_candidate
            })
            socketio.emit('complete', {
                'session_id': session_id,
                'found': True,
                'password': target_password,
                'attempts': attempts,
                'elapsed': round(elapsed, 4),
                'message': 'Password cracked successfully!'
            })
            return
        
        # Prune: only go deeper if current length < target length
        if len(next_candidate) < max_len:
            stack.append((next_candidate, 0))
    
    elapsed = time.time() - start_time
    if session_id in active_sessions:
        active_sessions[session_id]['running'] = False
    socketio.emit('complete', {
        'session_id': session_id,
        'found': False,
        'attempts': attempts,
        'elapsed': round(elapsed, 4),
        'message': 'Session stopped'
    })


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'message': 'Password Cracker Backend Running'})


@app.route('/api/analyze', methods=['POST'])
def analyze_password():
    """Analyze password strength without cracking."""
    data = request.json
    password = data.get('password', '')
    
    if not password:
        return jsonify({'error': 'Password is required'}), 400
    
    has_lower = any(c in string.ascii_lowercase for c in password)
    has_upper = any(c in string.ascii_uppercase for c in password)
    has_digit = any(c in string.digits for c in password)
    has_symbol = any(c in string.punctuation for c in password)
    
    charset_size = 0
    if has_lower: charset_size += 26
    if has_upper: charset_size += 26
    if has_digit: charset_size += 10
    if has_symbol: charset_size += 32
    
    total_combinations = charset_size ** len(password) if charset_size > 0 else 0
    
    # Estimate crack time (assuming 1 billion attempts/second)
    attempts_per_second = 1_000_000_000
    estimated_seconds = total_combinations / attempts_per_second
    
    def format_time(seconds):
        if seconds < 1: return f"{seconds*1000:.2f} milliseconds"
        if seconds < 60: return f"{seconds:.2f} seconds"
        if seconds < 3600: return f"{seconds/60:.2f} minutes"
        if seconds < 86400: return f"{seconds/3600:.2f} hours"
        if seconds < 31536000: return f"{seconds/86400:.2f} days"
        if seconds < 3153600000: return f"{seconds/31536000:.2f} years"
        return f"{seconds/31536000:.2e} years"
    
    score = 0
    if len(password) >= 8: score += 1
    if len(password) >= 12: score += 1
    if len(password) >= 16: score += 1
    if has_lower: score += 1
    if has_upper: score += 1
    if has_digit: score += 1
    if has_symbol: score += 2
    
    strength = 'Very Weak'
    if score >= 7: strength = 'Very Strong'
    elif score >= 5: strength = 'Strong'
    elif score >= 4: strength = 'Moderate'
    elif score >= 2: strength = 'Weak'
    
    return jsonify({
        'password': '*' * len(password),
        'length': len(password),
        'charset_size': charset_size,
        'total_combinations': total_combinations,
        'estimated_crack_time': format_time(estimated_seconds),
        'estimated_seconds': estimated_seconds,
        'strength': strength,
        'strength_score': score,
        'has_lowercase': has_lower,
        'has_uppercase': has_upper,
        'has_digits': has_digit,
        'has_symbols': has_symbol
    })


@app.route('/api/crack/start', methods=['POST'])
def start_crack():
    data = request.json
    target = data.get('password', '')
    options = data.get('options', {})
    session_id = data.get('session_id', str(time.time()))
    mode = data.get('mode', 'recursive')  # recursive or iterative
    
    if not target:
        return jsonify({'error': 'Target password required'}), 400
    
    if len(target) > 6:
        return jsonify({'error': 'For demo purposes, max password length is 6 characters'}), 400
    
    charset = get_charset(options)
    
    # Check all chars are in charset
    for ch in target:
        if ch not in charset:
            return jsonify({'error': f'Character "{ch}" not in selected charset. Enable the correct character set.'}), 400
    
    total = calculate_complexity(len(charset), len(target))
    
    active_sessions[session_id] = {
        'running': True,
        'target': target,
        'charset': charset,
        'start_time': time.time()
    }
    
    if mode == 'iterative':
        thread = threading.Thread(
            target=iterative_backtrack_crack,
            args=(target, charset, session_id),
            daemon=True
        )
    else:
        thread = threading.Thread(
            target=backtracking_crack,
            args=(target, charset, session_id),
            daemon=True
        )
    thread.start()
    
    return jsonify({
        'session_id': session_id,
        'message': 'Cracking started',
        'charset': charset,
        'charset_size': len(charset),
        'max_combinations': total
    })


@app.route('/api/crack/stop', methods=['POST'])
def stop_crack():
    data = request.json
    session_id = data.get('session_id')
    
    if session_id in active_sessions:
        active_sessions[session_id]['running'] = False
        return jsonify({'message': 'Cracking stopped', 'session_id': session_id})
    
    return jsonify({'error': 'Session not found'}), 404


@app.route('/api/complexity', methods=['POST'])
def get_complexity():
    data = request.json
    charset_size = data.get('charset_size', 26)
    length = data.get('length', 4)
    
    combinations = []
    total = 0
    for l in range(1, length + 1):
        c = charset_size ** l
        total += c
        combinations.append({'length': l, 'combinations': c})
    
    return jsonify({
        'combinations_by_length': combinations,
        'total': total,
        'charset_size': charset_size
    })


@socketio.on('connect')
def handle_connect():
    print(f'Client connected: {request.sid}')

@socketio.on('disconnect')
def handle_disconnect():
    print(f'Client disconnected: {request.sid}')


if __name__ == '__main__':
    print("Password Cracker Backend starting on http://localhost:5000")
    socketio.run(app, debug=False, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)

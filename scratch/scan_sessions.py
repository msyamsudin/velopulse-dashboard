import json

with open('workouts_rows.json', 'r') as f:
    data = json.load(f)

for i, session in enumerate(data):
    stats = json.loads(session['stats']) if isinstance(session['stats'], str) else session['stats']
    history = json.loads(session['history']) if isinstance(session['history'], str) else session['history']
    
    # Check last point distance
    if history:
        last_dist = history[-1].get('distance', 0)
        print(f"Session {i}: Duration={session['duration']}, Final Dist={last_dist}")
        
        # Look for 3526 or 7910 or similar
        if last_dist > 3000 or session['duration'] > 400:
             print(f"  Possible match: Dist {last_dist}, Duration {session['duration']}")

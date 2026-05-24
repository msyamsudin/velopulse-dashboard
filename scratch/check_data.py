import json

with open('workouts_rows.json', 'r') as f:
    data = json.load(f)

first_session = data[0]
print(f"Session Start Time: {first_session['session_start_time']}")
print(f"Duration: {first_session['duration']}")

history = json.loads(first_session['history'])
last_point = history[-1]
print(f"Last Point: {last_point}")

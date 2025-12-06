const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 4000; // front end will call http://localhost:4000

const DATA_FILE = path.join(__dirname, 'students.json');

app.use(cors());
app.use(bodyParser.json());

// ----- helpers to read / write JSON file -----
function readStudents() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (e) {
    return {};
  }
}

function writeStudents(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ----- academic score algorithm -----
function percent(done, total) {
  if (!total || total <= 0) return 0;
  return (done / total) * 100;
}

function calcAcademic(stu) {
  const testPct = stu.test != null ? stu.test : 0;
  const attPct = percent(stu.att, stu.attTotal);
  const hwPct = percent(stu.hw, stu.hwTotal);

  const overallPct = 0.5 * testPct + 0.3 * attPct + 0.2 * hwPct;
  let score = (overallPct / 100) * 10;
  if (score < 1 && (stu.test || stu.att || stu.hw)) score = 1;
  if (score > 10) score = 10;
  stu.academic = Number(score.toFixed(2));
}

// ---------- ROUTES ----------

// Student sign up
app.post('/api/students/signup', (req, res) => {
  const { id, name, password } = req.body;
  if (!id || !name || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const students = readStudents();
  if (students[id]) {
    return res.status(409).json({ error: 'Student already exists' });
  }

  students[id] = {
    name,
    password,
    test: null,
    att: 0,
    attTotal: 0,
    hw: 0,
    hwTotal: 0,
    academic: null
  };

  writeStudents(students);
  res.json({ message: 'Student created' });
});

// Student login
app.post('/api/students/login', (req, res) => {
  const { id, password } = req.body;
  const students = readStudents();
  const stu = students[id];
  if (!stu || stu.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  res.json({ id, name: stu.name });
});

// Get one student (for dashboard)
app.get('/api/students/:id', (req, res) => {
  const students = readStudents();
  const stu = students[req.params.id];
  if (!stu) return res.status(404).json({ error: 'Not found' });
  res.json(stu);
});

// Get all students (for leaderboard + teacher view)
app.get('/api/students', (req, res) => {
  const students = readStudents();
  res.json(students);
});

// Teacher: save test score
app.post('/api/teacher/test', (req, res) => {
  const { id, score } = req.body;
  const students = readStudents();
  const stu = students[id];
  if (!stu) return res.status(404).json({ error: 'Student not found' });

  if (score < 0 || score > 100) {
    return res.status(400).json({ error: 'Score must be 0–100' });
  }

  stu.test = Number(score);
  calcAcademic(stu);
  writeStudents(students);
  res.json(stu);
});

// Teacher: save attendance
app.post('/api/teacher/attendance', (req, res) => {
  const { id, present, total } = req.body;
  const students = readStudents();
  const stu = students[id];
  if (!stu) return res.status(404).json({ error: 'Student not found' });

  if (total <= 0 || present < 0 || present > total) {
    return res.status(400).json({ error: 'Bad attendance values' });
  }

  stu.att = Number(present);
  stu.attTotal = Number(total);
  calcAcademic(stu);
  writeStudents(students);
  res.json(stu);
});

// Teacher: save homework
app.post('/api/teacher/homework', (req, res) => {
  const { id, done, total } = req.body;
  const students = readStudents();
  const stu = students[id];
  if (!stu) return res.status(404).json({ error: 'Student not found' });

  if (total <= 0 || done < 0 || done > total) {
    return res.status(400).json({ error: 'Bad homework values' });
  }

  stu.hw = Number(done);
  stu.hwTotal = Number(total);
  calcAcademic(stu);
  writeStudents(students);
  res.json(stu);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

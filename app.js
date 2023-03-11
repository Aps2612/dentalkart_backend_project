if (process.env.NODE_ENV !== 'production'){
    require('dotenv').config()
}


const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const csv = require('csv-parser');
const fs = require('fs');
const { promisify } = require('util');
const pipeline = promisify(require('stream').pipeline);

// Initialize express app
const app = express();

app.set('view engine','ejs');
app.use(express.urlencoded({ extended : false}));

// Connect to MongoDB database
mongoose.connect('mongodb://0.0.0.0:27017/students', { useNewUrlParser: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error(err));

// Define student schema
const studentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  roll_no: {
    type: Number,
    required: true,
  },
  address: {
    type: String,
    required: true
  },
  institute: {
    type: String,
    required: true
  },
  course: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  }
});

// Define user schema
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  }
});

// Define models
const Student = mongoose.model('Student', studentSchema);
const User = mongoose.model('User', userSchema);

// Middleware to parse JSON requests
app.use(express.json());


app.get('/login',(req,res)=>{
    res.render('login.ejs');
});

app.get('/register',(req,res)=>{
    res.render('register.ejs');
});

// Middleware to handle errors
app.use(function(err, req, res, next){
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

// Define storage for uploaded CSV files
const storage = multer.diskStorage({
  destination: function (req, file, cb){
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb){
    cb(null, file.originalname);
  }
});

// Create upload object with storage settings
// const upload = multer({ storage: storage });

// Register a new user
app.post('/register', async function (req, res){
  try {
    const { email, password } = req.body;

    // console.log(req.body.email);

    // Check if user already exists
    const user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const salt = 10;
    const hashedPassword = await bcrypt.hash(password,salt);

    // Create user
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();

    // Generate JWT token
    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '2d' });

    res.redirect('/login');
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// Login a user
app.post('/login', async function (req, res){
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '2d' });

res.send(`Welcome to Dentalkart your token is ${token}`);
} catch (err) {
console.error(err);
res.status(500).send('Server error');
}
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
  });





// Add a list of students from CSV file to the database
app.post('/students',upload.single('file'),async (req, res) => {
try {
  const results = [];

// Read CSV file and insert unique rows into database
    fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', async (data) => {
        try {
        console.log(data);
//         // Check if row already exists in the database
//         console.log(data);
        const { Name, Roll_no, Address,Institute, Course, Email } = data;
        const existingStudent = await Student.findOne({ Roll_no });
        // console.log(existingStudent);
        if (!existingStudent) {
          // Insert row into database
          const newStudent = new Student({ Name,Roll_no,Address,Institute,Course,Email });
          await newStudent.save();
          results.push({ success: true, data: newStudent });
        } else {
          results.push({ success: false, data: existingStudent });
        }
      } catch (err) {
        console.error(err);
        results.push({ success: false, error: err.message });
      }
    })
    .on('end', async () => {
      // Remove uploaded CSV file
      await fs.promises.unlink(req.file.path);
       res.json({ results });
    });
} catch (err) {
console.error(err);
res.status(500).send('Server error');
}
});

// Get a list of all students in the database
app.get('/students', async (req, res) => {
try {
  const students = await Student.find();

  res.json(students);
} catch (err) {
  console.error(err);
  res.status(500).send('Server error');
}
});

// Download a CSV file of all students in the database
app.get('/students/download', async (req, res) => {
try {
  const students = await Student.find();

  // Convert students data to CSV string
  const fields = [ 'name','roll_no','address','institute','course','email'];
  const opts = { fields };
  const csvData = await parseAsync(students, opts);

  // Set headers for CSV file download
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=students.csv');

  // Send CSV file
  res.send(csvData);
} catch (err) {
  console.error(err);
  res.status(500).send('Server error');
}
});

// Start server
const port = 5000;
app.listen(port, () => console.log(`Server started on port ${port}`));


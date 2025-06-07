const express = require('express');
const sql = require('mssql');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = express();
const port = 3000;
const jwtSecret = 'Slava_Komu?_Mne25';    
app.use(bodyParser.json());
app.use(cors());
app.use(express.static('public'));
// Конфигурация SQL Server
const config = {
  user: 'your_username',
  password: 'your_password',
  server: 'localhost',
  database: 'RandomShopDB',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};
// Регистрация с хешированием пароля
app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    await sql.connect(config);
    // Проверка, существует ли уже пользователь
    const userCheck = await sql.query`SELECT * FROM Users WHERE Email = ${email}`;
    if (userCheck.recordset.length > 0) {
      return res.status(400).send('User already exists');
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    // Запись нового пользователя
    await sql.query`
      INSERT INTO Users (Name, Email, Password)
      VALUES (${name}, ${email}, ${hashedPassword})
    `;
    res.status(200).send('User registered successfully');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error registering user');
  }
});
// Вход с проверкой пароля и выдачей JWT
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    await sql.connect(config);
    const result = await sql.query`SELECT * FROM Users WHERE Email = ${email}`;
    const user = result.recordset[0];
    if (!user) {
      return res.status(401).send('User not found');
    }
    // Сравниваем пароль с хешем
    const match = await bcrypt.compare(password, user.Password);
    if (!match) {
      return res.status(401).send('Invalid password');
    }
    // Генерация JWT токена
    const token = jwt.sign(
      { id: user.Id, name: user.Name, email: user.Email },
      jwtSecret,
      { expiresIn: '2h' }
    );
    res.status(200).json({ message: 'Login successful', token });
  } catch (err) {
    console.error(err);
    res.status(500).send('Login error');
  }
});
//  Middleware — проверка JWT (для защищённых роутов)
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}
app.get('/profile', authenticateToken, (req, res) => {
  res.json({ message: `Welcome, ${req.user.name}!`, email: req.user.email });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

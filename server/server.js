const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Инициализация базы данных
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('❌ Ошибка подключения к базе данных:', err.message);
  } else {
    console.log('✅ Подключение к SQLite базе данных успешно');
    initDatabase();
  }
});

// Создание таблицы
function initDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('❌ Ошибка создания таблицы:', err.message);
    } else {
      console.log('✅ Таблица items готова');
    }
  });
}

// ==================== REST API ====================

// Получить все записи
app.get('/api/items', (req, res) => {
  db.all('SELECT * FROM items ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ items: rows });
  });
});

// Создать новую запись
app.post('/api/items', (req, res) => {
  const { title, description } = req.body;
  
  if (!title) {
    res.status(400).json({ error: 'Название обязательно' });
    return;
  }

  db.run(
    'INSERT INTO items (title, description) VALUES (?, ?)',
    [title, description],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      const newItem = {
        id: this.lastID,
        title,
        description,
        created_at: new Date().toISOString()
      };
      
      // Уведомить всех клиентов через WebSocket
      io.emit('item_created', newItem);
      
      res.status(201).json(newItem);
    }
  );
});

// Обновить запись
app.put('/api/items/:id', (req, res) => {
  const { id } = req.params;
  const { title, description } = req.body;
  
  if (!title) {
    res.status(400).json({ error: 'Название обязательно' });
    return;
  }

  db.run(
    'UPDATE items SET title = ?, description = ? WHERE id = ?',
    [title, description, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (this.changes === 0) {
        res.status(404).json({ error: 'Запись не найдена' });
        return;
      }
      
      const updatedItem = {
        id: parseInt(id),
        title,
        description
      };
      
      // Уведомить всех клиентов через WebSocket
      io.emit('item_updated', updatedItem);
      
      res.json(updatedItem);
    }
  );
});

// Удалить запись
app.delete('/api/items/:id', (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM items WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: 'Запись не найдена' });
      return;
    }
    
    // Уведомить всех клиентов через WebSocket
    io.emit('item_deleted', { id: parseInt(id) });
    
    res.json({ message: 'Запись удалена', id: parseInt(id) });
  });
});

// ==================== WebSocket ====================

let connectedClients = 0;

io.on('connection', (socket) => {
  connectedClients++;
  console.log(`✅ Клиент подключен. Всего клиентов: ${connectedClients}`);
  
  // Отправить текущее количество подключенных клиентов
  io.emit('clients_count', connectedClients);

  socket.on('disconnect', () => {
    connectedClients--;
    console.log(`❌ Клиент отключен. Всего клиентов: ${connectedClients}`);
    io.emit('clients_count', connectedClients);
  });
});

// ==================== Запуск сервера ====================

server.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   🚀 СЕРВЕР СИНХРОНИЗАЦИИ ЗАПУЩЕН             ║');
  console.log('╟────────────────────────────────────────────────╢');
  console.log(`║   📡 HTTP API:     http://localhost:${PORT}       ║`);
  console.log(`║   🔌 WebSocket:    ws://localhost:${PORT}         ║`);
  console.log('║   💾 База данных:  SQLite (database.db)        ║');
  console.log('╟────────────────────────────────────────────────╢');
  console.log('║   Для доступа с других компьютеров:            ║');
  console.log('║   Используйте IP-адрес этого компьютера        ║');
  console.log('║   Пример: http://192.168.1.100:3000            ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️  Остановка сервера...');
  db.close((err) => {
    if (err) {
      console.error('❌ Ошибка закрытия базы данных:', err.message);
    } else {
      console.log('✅ База данных закрыта');
    }
    process.exit(0);
  });
});

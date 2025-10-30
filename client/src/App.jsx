import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import axios from 'axios';

// ВАЖНО: Замените на IP-адрес вашего сервера!
// Например: const SERVER_URL = 'http://192.168.1.100:3000';
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

function App() {
  const [items, setItems] = useState([]);
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [clientsCount, setClientsCount] = useState(0);
  
  // Форма создания/редактирования
  const [formData, setFormData] = useState({ title: '', description: '' });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  // Подключение к серверу и WebSocket
  useEffect(() => {
    // Загрузка данных
    fetchItems();

    // Подключение WebSocket
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('✅ WebSocket подключен');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ WebSocket отключен');
      setConnected(false);
    });

    newSocket.on('clients_count', (count) => {
      setClientsCount(count);
    });

    // Обработка событий синхронизации
    newSocket.on('item_created', (newItem) => {
      console.log('📥 Получена новая запись:', newItem);
      setItems(prev => [newItem, ...prev]);
    });

    newSocket.on('item_updated', (updatedItem) => {
      console.log('📝 Запись обновлена:', updatedItem);
      setItems(prev => prev.map(item => 
        item.id === updatedItem.id ? { ...item, ...updatedItem } : item
      ));
    });

    newSocket.on('item_deleted', ({ id }) => {
      console.log('🗑️ Запись удалена:', id);
      setItems(prev => prev.filter(item => item.id !== id));
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Загрузка всех записей
  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${SERVER_URL}/api/items`);
      setItems(response.data.items);
    } catch (error) {
      console.error('❌ Ошибка загрузки данных:', error);
      alert('Не удалось подключиться к серверу. Проверьте адрес сервера.');
    } finally {
      setLoading(false);
    }
  };

  // Создание новой записи
  const handleCreate = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      alert('Введите название!');
      return;
    }

    try {
      setLoading(true);
      await axios.post(`${SERVER_URL}/api/items`, formData);
      setFormData({ title: '', description: '' });
    } catch (error) {
      console.error('❌ Ошибка создания записи:', error);
      alert('Ошибка создания записи');
    } finally {
      setLoading(false);
    }
  };

  // Обновление записи
  const handleUpdate = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      alert('Введите название!');
      return;
    }

    try {
      setLoading(true);
      await axios.put(`${SERVER_URL}/api/items/${editingId}`, formData);
      setFormData({ title: '', description: '' });
      setEditingId(null);
    } catch (error) {
      console.error('❌ Ошибка обновления записи:', error);
      alert('Ошибка обновления записи');
    } finally {
      setLoading(false);
    }
  };

  // Удаление записи
  const handleDelete = async (id) => {
    if (!confirm('Вы уверены, что хотите удалить эту запись?')) {
      return;
    }

    try {
      setLoading(true);
      await axios.delete(`${SERVER_URL}/api/items/${id}`);
    } catch (error) {
      console.error('❌ Ошибка удаления записи:', error);
      alert('Ошибка удаления записи');
    } finally {
      setLoading(false);
    }
  };

  // Начать редактирование
  const startEdit = (item) => {
    setEditingId(item.id);
    setFormData({ title: item.title, description: item.description || '' });
  };

  // Отменить редактирование
  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ title: '', description: '' });
  };

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        
        {/* Шапка */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                🔄 Система синхронизации данных
              </h1>
              <p className="text-gray-600 mt-1">Локальная сеть - Реал-тайм обновления</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 justify-end mb-1">
                <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                <span className={`font-semibold ${connected ? 'text-green-600' : 'text-red-600'}`}>
                  {connected ? 'Подключено' : 'Отключено'}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                👥 Клиентов онлайн: <span className="font-bold">{clientsCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Форма создания/редактирования */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            {editingId ? '✏️ Редактировать запись' : '➕ Создать новую запись'}
          </h2>
          
          <form onSubmit={editingId ? handleUpdate : handleCreate}>
            <div className="mb-4">
              <label className="block text-gray-700 font-semibold mb-2">
                Название *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                placeholder="Введите название..."
                disabled={loading}
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 font-semibold mb-2">
                Описание
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                placeholder="Введите описание..."
                rows="3"
                disabled={loading}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '⏳ Загрузка...' : (editingId ? '💾 Сохранить' : '➕ Создать')}
              </button>
              
              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={loading}
                  className="px-6 bg-gray-400 hover:bg-gray-500 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50"
                >
                  ❌ Отмена
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Список записей */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            📋 Все записи ({items.length})
          </h2>

          {loading && items.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              <div className="animate-spin text-4xl mb-2">⏳</div>
              <p>Загрузка данных...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              <div className="text-6xl mb-2">📝</div>
              <p className="text-lg">Пока нет записей</p>
              <p className="text-sm">Создайте первую запись выше!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-800 mb-1">
                        {item.title}
                      </h3>
                      {item.description && (
                        <p className="text-gray-600 mb-2">{item.description}</p>
                      )}
                      <p className="text-xs text-gray-400">
                        ID: {item.id} | Создано: {new Date(item.created_at).toLocaleString('ru-RU')}
                      </p>
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => startEdit(item)}
                        disabled={loading}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition disabled:opacity-50"
                      >
                        ✏️ Изменить
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={loading}
                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition disabled:opacity-50"
                      >
                        🗑️ Удалить
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Подвал */}
        <div className="mt-6 text-center text-white text-sm">
          <p>💡 Изменения на любом компьютере автоматически отображаются на всех остальных</p>
          <p className="mt-1">Адрес сервера: <code className="bg-white bg-opacity-20 px-2 py-1 rounded">{SERVER_URL}</code></p>
        </div>
      </div>
    </div>
  );
}

export default App;

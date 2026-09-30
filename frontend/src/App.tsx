import { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { CategoryFilter } from './components/CategoryFilter';
import { EventCard } from './components/EventCard';
import { EventDetailModal } from './components/EventDetailModal';
import { WaitingRoomModal } from './components/WaitingRoomModal';
import { CheckoutModal } from './components/CheckoutModal';
import { AuthModal } from './components/AuthModal';
import { ProfilePage } from './components/ProfilePage';
import { TicketsPage } from './components/TicketsPage';
import { CreateEventPage } from './components/CreateEventPage';
import { AdminDashboard } from './components/AdminDashboard';
import { NotificationModal, type AppNotification } from './components/NotificationModal';
import { api, type Event, type User } from './lib/api';
import { subscribeStock } from './lib/ws';
import { RiHome5Fill, RiUser3Line } from 'react-icons/ri';
import { FiShield } from 'react-icons/fi';
import { HiTicket } from 'react-icons/hi2';
import { CgSpinner } from 'react-icons/cg';

type AppView = 'home' | 'admin' | 'profile' | 'tickets' | 'create_event';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentView, setCurrentView] = useState<AppView>('home');

  // Modals state (For War Ticket & Auth)
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isWaitingRoomOpen, setIsWaitingRoomOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // 🔔 Notifications State (Persisted in localStorage)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem('flash_sale_notifs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((n: any) => ({ ...n, timestamp: new Date(n.timestamp) }));
      } catch (e) {
        // Fallback
      }
    }
    return [
      {
        id: 'welcome-notif',
        title: 'Welcome to Flash Sale Tickets',
        message: 'Explore live concerts and enjoy fair queue protection with Zero-Overselling.',
        timestamp: new Date(Date.now() - 1000 * 60 * 5),
        type: 'stock_alert',
        read: false,
      },
    ];
  });

  // Ref to guarantee strictly 1-time execution per admission pass
  const alertedPassesRef = useRef<Set<string>>(new Set());

  const isAdmin = user?.role?.toLowerCase() === 'admin';

  useEffect(() => {
    localStorage.setItem('flash_sale_notifs', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
      } catch (e) {
        console.error(e);
      }
    }
    fetchEvents();
  }, []);

  // Reset admin views if not admin
  useEffect(() => {
    if (!isAdmin && (currentView === 'admin' || currentView === 'create_event')) {
      setCurrentView('home');
    }
  }, [user, isAdmin, currentView]);

  const fetchEvents = async () => {
    setIsLoadingEvents(true);
    try {
      const data = await api.getEvents();
      setEvents(data || []);
    } catch (e) {
      console.error('Failed to fetch events:', e);
      setEvents([]);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  // 📡 SUBSCRIBE TO REAL-TIME STOCK UPDATES VIA WEBSOCKET
  useEffect(() => {
    if (!events || events.length === 0) return;

    const unsubscribers = events.map((event) => {
      return subscribeStock(event.id, (updatedEvent) => {
        setEvents((prev) =>
          prev.map((e) =>
            e.id === updatedEvent.id
              ? { ...e, availableStock: updatedEvent.availableStock, status: updatedEvent.status }
              : e
          )
        );

        setSelectedEvent((prev) => (prev?.id === updatedEvent.id ? { ...prev, availableStock: updatedEvent.availableStock } : prev));
      });
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [events?.length || 0]);

  const playChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc1 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc1.frequency.setValueAtTime(880, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc1.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc1.stop(ctx.currentTime + 0.6);
    } catch (e) {
      // Ignore if audio blocked
    }
  };

  const addNotification = (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: AppNotification = {
      ...notif,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date(),
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(newNotif.title, { body: newNotif.message });
      } catch (e) {
        // Silently catch
      }
    }
  };

  // 🔔 SINGLE-SHOT ADMISSION DISPATCHER
  const notifyAdmission = (eventId: string, eventName?: string) => {
    const dedupeKey = `${user?.id || 'user'}_${eventId}`;
    if (alertedPassesRef.current.has(dedupeKey)) {
      return;
    }
    alertedPassesRef.current.add(dedupeKey);

    localStorage.removeItem('activeQueueEventId');
    const name = eventName || 'event flash sale';
    playChime();

    addNotification({
      title: "It's Your Turn! 🎟️",
      message: `You have been admitted from the queue for ${name}. Your 5-minute checkout session is active.`,
      type: 'admitted',
      eventId,
    });
  };

  // 🔄 GLOBAL BACKGROUND QUEUE MONITOR
  useEffect(() => {
    if (!user) return;

    const checkQueue = async () => {
      const queuedId = localStorage.getItem('activeQueueEventId');
      if (!queuedId) return;

      const dedupeKey = `${user.id}_${queuedId}`;
      if (alertedPassesRef.current.has(dedupeKey)) {
        localStorage.removeItem('activeQueueEventId');
        return;
      }

      try {
        const status = await api.getQueueStatus(queuedId);
        if (status.isAllowedToPurchase) {
          const foundEvent = events.find((e) => e.id === queuedId);
          notifyAdmission(queuedId, foundEvent?.name);
        }
      } catch (e) {
        // Silently catch
      }
    };

    const interval = setInterval(checkQueue, 2500);
    return () => clearInterval(interval);
  }, [user, events]);

  const handleLoginSuccess = (loggedInUser: User, token: string) => {
    setUser(loggedInUser);
    localStorage.setItem('user', JSON.stringify(loggedInUser));
    localStorage.setItem('token', token);
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentView('home');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('activeQueueEventId');
    alertedPassesRef.current.clear();
  };

  const handleWarTicket = (event: Event) => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    const dedupeKey = `${user.id}_${event.id}`;
    alertedPassesRef.current.delete(dedupeKey);

    setSelectedEvent(event);
    localStorage.setItem('activeQueueEventId', event.id);
    setIsDetailOpen(false);
    setIsWaitingRoomOpen(true);
  };

  const handleViewDetail = (event: Event) => {
    setSelectedEvent(event);
    setIsDetailOpen(true);
  };

  const handleAdmitted = (wasWaiting: boolean = false) => {
    setIsWaitingRoomOpen(false);
    setIsCheckoutOpen(true);
    if (wasWaiting && selectedEvent) {
      notifyAdmission(selectedEvent.id, selectedEvent.name);
    }
  };

  const filteredEvents = events.filter((e) => {
    const desc = e.description || '';
    const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) || desc.toLowerCase().includes(searchQuery.toLowerCase());
    const eventCategory = (e.category || 'concerts').toLowerCase();
    const matchesCategory = selectedCategory === 'all' || eventCategory === selectedCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  const unreadNotifsCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-slate-100/90 text-slate-900 font-sans flex justify-center antialiased">
      {/* 📱 MOBILE FRAME CONTAINER (Centering on Desktop & Full View on Mobile) */}
      <div className="w-full max-w-md min-h-screen bg-white shadow-2xl border-x border-slate-200/90 relative flex flex-col justify-between pb-24">
        <div>
          {/* 1. 👤 FULL PAGE: PROFILE & SETTINGS */}
          {currentView === 'profile' ? (
            <ProfilePage
              user={user}
              onBack={() => setCurrentView('home')}
              onLogout={handleLogout}
              onNavigateTickets={() => setCurrentView('tickets')}
              onUpdateUser={(updated) => {
                setUser(updated);
                localStorage.setItem('user', JSON.stringify(updated));
              }}
            />
          ) : currentView === 'tickets' ? (
            /* 2. 🎟️ FULL PAGE: MY TICKETS */
            <TicketsPage
              user={user}
              onBack={() => setCurrentView('home')}
              onExplore={() => setCurrentView('home')}
              events={events}
              onOpenCheckout={(ev) => {
                setSelectedEvent(ev);
                setIsCheckoutOpen(true);
              }}
              onOpenWaitingRoom={(ev) => {
                setSelectedEvent(ev);
                setIsWaitingRoomOpen(true);
              }}
            />
          ) : currentView === 'create_event' ? (
            /* 3. ➕ FULL PAGE: CREATE NEW FLASH SALE EVENT */
            <CreateEventPage
              onBack={() => setCurrentView('admin')}
              onSuccess={() => {
                fetchEvents();
                setCurrentView('admin');
              }}
            />
          ) : (
            /* 4. 📄 PAGES WITH TOP HEADER (HOME / ADMIN DASHBOARD) */
            <>
              <Header
                user={user}
                onOpenAuth={() => setIsAuthOpen(true)}
                onLogout={handleLogout}
                isAdminView={currentView === 'admin'}
                onToggleAdmin={() => setCurrentView(currentView === 'admin' ? 'home' : 'admin')}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onOpenNotifications={() => setIsNotificationsOpen(true)}
                unreadCount={unreadNotifsCount}
              />

              {isAdmin && currentView === 'admin' ? (
                /* 📊 ADMIN CONSOLE PAGE VIEW */
                <main className="px-4 py-4 space-y-4 animate-fadeIn">
                  <AdminDashboard
                    events={events}
                    onRefreshEvents={fetchEvents}
                    onNavigateCreateEvent={() => setCurrentView('create_event')}
                  />
                </main>
              ) : (
                /* 🎟️ USER EXPERIENCE HOME PAGE VIEW (MOBILE SINGLE-COLUMN) */
                <main className="px-4 py-4 space-y-4 animate-fadeIn">
                  <CategoryFilter
                    selectedCategory={selectedCategory}
                    onSelectCategory={setSelectedCategory}
                  />

                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                      Active Flash Sale Events
                    </h2>
                    <button
                      onClick={() => setSelectedCategory('all')}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                    >
                      View All ({filteredEvents.length})
                    </button>
                  </div>

                  {isLoadingEvents ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 bg-slate-50 rounded-2xl border border-slate-200">
                      <CgSpinner className="w-8 h-8 text-indigo-600 animate-spin" />
                      <span className="text-xs font-semibold text-slate-500">Loading flash sale events...</span>
                    </div>
                  ) : filteredEvents.length === 0 ? (
                    <div className="bg-slate-50 rounded-2xl p-8 text-center border border-slate-200">
                      <p className="text-xs font-semibold text-slate-500">No active flash sale events found.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredEvents.map((event) => (
                        <EventCard
                          key={event.id}
                          event={event}
                          onWarTicket={handleWarTicket}
                          onViewDetail={handleViewDetail}
                        />
                      ))}
                    </div>
                  )}
                </main>
              )}
            </>
          )}
        </div>

        {/* 📱 MOBILE BOTTOM NAVIGATION DOCK (Always visible on mobile frame) */}
        <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-4 pointer-events-none">
          <div className="bg-slate-900/95 backdrop-blur-xl rounded-2xl p-2 shadow-dock border border-slate-700/80 flex items-center justify-around pointer-events-auto">
            {/* 1. Home Tab */}
            <button
              onClick={() => {
                setCurrentView('home');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                currentView === 'home'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Event Catalog"
            >
              <RiHome5Fill className="w-5 h-5" />
            </button>

            {/* 2. Admin Tab (Only if admin role) */}
            {isAdmin && (
              <button
                onClick={() => {
                  setCurrentView('admin');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  currentView === 'admin' || currentView === 'create_event'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Admin Dashboard"
              >
                <FiShield className="w-5 h-5" />
              </button>
            )}

            {/* 3. My Tickets Tab */}
            <button
              onClick={() => {
                if (user) {
                  setCurrentView('tickets');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                  setIsAuthOpen(true);
                }
              }}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                currentView === 'tickets'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="My Tickets"
            >
              <HiTicket className="w-5 h-5" />
            </button>

            {/* 4. Profile Tab */}
            <button
              onClick={() => {
                if (user) {
                  setCurrentView('profile');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                  setIsAuthOpen(true);
                }
              }}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                currentView === 'profile'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title={user ? 'My Profile' : 'Sign In / Register'}
            >
              <RiUser3Line className="w-5 h-5" />
            </button>
          </div>
        </nav>
      </div>

      {/* Modals Container */}
      <NotificationModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllAsRead={() => {
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        }}
        onClearAll={() => setNotifications([])}
        onSelectNotification={(notif) => {
          setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)));
          if (notif.type === 'admitted') {
            const foundEvent = events.find((e) => e.id === notif.eventId) || events[0];
            if (foundEvent) {
              setSelectedEvent(foundEvent);
              setIsNotificationsOpen(false);
              setIsCheckoutOpen(true);
            }
          } else if (notif.type === 'order_confirmed') {
            setIsNotificationsOpen(false);
            setCurrentView('tickets');
          }
        }}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={handleLoginSuccess}
      />

      <EventDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        event={selectedEvent}
        onContinue={handleWarTicket}
      />

      <WaitingRoomModal
        isOpen={isWaitingRoomOpen}
        onClose={() => setIsWaitingRoomOpen(false)}
        event={selectedEvent}
        onAdmitted={handleAdmitted}
      />

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        event={selectedEvent}
        onSuccess={() => {
          fetchEvents();
          addNotification({
            title: 'Order Confirmed! 🎫',
            message: `Your ticket for ${selectedEvent?.name || 'event'} has been successfully secured.`,
            type: 'order_confirmed',
            eventId: selectedEvent?.id,
          });
        }}
      />
    </div>
  );
}

export default App;

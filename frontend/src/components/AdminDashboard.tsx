import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiShield, FiUsers, FiDollarSign, FiActivity, FiRefreshCw, FiFileText, FiCheckCircle, FiXCircle, FiX, FiPlus, FiClock } from 'react-icons/fi';
import { HiTicket } from 'react-icons/hi2';
import { IoFlash, IoSparkles } from 'react-icons/io5';
import { CgSpinner } from 'react-icons/cg';
import { api, type Order, type Event, type OrderLog } from '../lib/api';

interface AdminDashboardProps {
  events: Event[];
  onRefreshEvents: () => void;
  onNavigateCreateEvent: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  events,
  onRefreshEvents,
  onNavigateCreateEvent,
}) => {
  const [selectedEventId, setSelectedEventId] = useState<string>(events[0]?.id || '');
  const [orders, setOrders] = useState<Order[]>([]);
  const [batchSize, setBatchSize] = useState<number>(5);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [isAdmitting, setIsAdmitting] = useState(false);
  const [admitMsg, setAdmitMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CONFIRMED' | 'PENDING' | 'FAILED'>('ALL');

  const [selectedOrderLogs, setSelectedOrderLogs] = useState<OrderLog[] | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');

  useEffect(() => {
    if (events.length > 0 && !selectedEventId) {
      setSelectedEventId(events[0].id);
    }
  }, [events]);

  const fetchOrders = async () => {
    setIsLoadingOrders(true);
    try {
      const res = await api.getAllOrders(selectedEventId ? selectedEventId : undefined);
      setOrders(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 4000);
    return () => clearInterval(interval);
  }, [selectedEventId]);

  const handleAdmit = async () => {
    if (!selectedEventId) return;
    setIsAdmitting(true);
    setAdmitMsg(null);
    try {
      const count = await api.admitUsers(selectedEventId, batchSize);
      setAdmitMsg({
        type: 'success',
        text: `Successfully admitted ${count} users to checkout desk`,
      });
      onRefreshEvents();
    } catch (e: any) {
      setAdmitMsg({ type: 'error', text: `Failed: ${e.message}` });
    } finally {
      setIsAdmitting(false);
    }
  };

  const handleViewLogs = async (orderId: string) => {
    setSelectedOrderId(orderId);
    try {
      const logs = await api.getOrderLogs(orderId);
      setSelectedOrderLogs(logs);
    } catch (e) {
      console.error(e);
    }
  };

  const currentEvent = events.find((e) => e.id === selectedEventId);
  const totalRevenue = orders.reduce((sum, o) => (o.status === 'CONFIRMED' ? sum + o.totalPrice : sum), 0);
  const totalSold = orders.filter((o) => o.status === 'CONFIRMED').length;
  const pendingOrders = orders.filter((o) => o.status === 'PENDING').length;

  const filteredOrders = orders.filter((o) => {
    if (statusFilter === 'ALL') return true;
    return o.status === statusFilter;
  });

  const formatPrice = (p: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(p);
  };

  const getStepMeta = (eventType: string) => {
    switch (eventType) {
      case 'ORDER_CREATED':
        return {
          title: 'Order Created',
          desc: 'Request validated and message published to RabbitMQ queue',
          icon: <HiTicket className="w-4 h-4 text-purple-600" />,
          dotBg: 'bg-purple-500',
          badgeClass: 'bg-purple-100 text-purple-700 border-purple-200',
        };
      case 'STOCK_RESERVED':
        return {
          title: 'Stock Reserved in Redis',
          desc: 'Lua script atomically deducted in-memory quota (0% race condition)',
          icon: <IoFlash className="w-4 h-4 text-amber-600" />,
          dotBg: 'bg-amber-500',
          badgeClass: 'bg-amber-100 text-amber-700 border-amber-200',
        };
      case 'ORDER_CONFIRMED':
        return {
          title: 'Order Confirmed',
          desc: 'Worker pool processed order and persisted to PostgreSQL database',
          icon: <FiCheckCircle className="w-4 h-4 text-emerald-600" />,
          dotBg: 'bg-emerald-500',
          badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        };
      case 'ORDER_FAILED':
        return {
          title: 'Order Failed',
          desc: 'Order processing failed and stock was rolled back to Redis RAM',
          icon: <FiXCircle className="w-4 h-4 text-red-600" />,
          dotBg: 'bg-red-500',
          badgeClass: 'bg-red-100 text-red-700 border-red-200',
        };
      default:
        return {
          title: eventType,
          desc: 'Lifecycle event log',
          icon: <FiActivity className="w-4 h-4 text-slate-600" />,
          dotBg: 'bg-slate-500',
          badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        };
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Event Selector & Quick Action Card */}
      <div className="bg-white rounded-[28px] p-4 shadow-card border border-purple-100/80">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-app-purple">
            <FiShield className="w-4 h-4" />
            <span>Selected Flash Sale Event</span>
          </div>
          <button
            onClick={() => {
              fetchOrders();
              onRefreshEvents();
            }}
            className="p-2 bg-[#F8F3FE] hover:bg-purple-100 rounded-xl text-app-purple transition-all"
            title="Refresh Data"
          >
            <FiRefreshCw className={`w-3.5 h-3.5 ${isLoadingOrders ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <select
          value={selectedEventId}
          onChange={(e) => setSelectedEventId(e.target.value)}
          className="w-full px-3 py-2.5 bg-[#F8F3FE] border border-purple-100 rounded-xl text-xs font-extrabold text-slate-800 outline-none focus:border-app-purple cursor-pointer mb-2.5"
        >
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} (Stock: {e.availableStock}/{e.totalStock})
            </option>
          ))}
        </select>

        {/* ➕ Navigate to Create Event Page */}
        <button
          onClick={onNavigateCreateEvent}
          className="w-full py-2.5 bg-purple-btn text-white rounded-xl text-xs font-black shadow-btn hover:opacity-95 transition-all flex items-center justify-center gap-1.5"
        >
          <FiPlus className="w-3.5 h-3.5" />
          <span>Create New Flash Sale Event</span>
        </button>
      </div>

      {/* 2x2 Mobile KPI Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Card 1: Tickets Sold */}
        <div className="bg-white rounded-[24px] p-3.5 border border-purple-100/80 shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Tickets Sold</span>
            <div className="w-7 h-7 rounded-xl bg-purple-100 text-app-purple flex items-center justify-center">
              <HiTicket className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-black text-slate-900 leading-none mb-1">
              {totalSold} <span className="text-[10px] text-slate-400 font-bold">/ {currentEvent?.totalStock || 0}</span>
            </div>
            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
              <FiCheckCircle className="w-3 h-3" /> Zero-Oversell
            </span>
          </div>
        </div>

        {/* Card 2: Total Revenue */}
        <div className="bg-white rounded-[24px] p-3.5 border border-purple-100/80 shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Total Revenue</span>
            <div className="w-7 h-7 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center">
              <FiDollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-app-purple to-app-magenta leading-none mb-1 truncate">
              {formatPrice(totalRevenue)}
            </div>
            <span className="text-[10px] font-bold text-slate-400 block">
              Confirmed in DB
            </span>
          </div>
        </div>

        {/* Card 3: Redis Live Stock */}
        <div className="bg-white rounded-[24px] p-3.5 border border-purple-100/80 shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Redis Stock</span>
            <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <FiActivity className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-black text-slate-900 leading-none mb-1">
              {currentEvent?.availableStock || 0} <span className="text-[10px] text-slate-400 font-bold">Tickets</span>
            </div>
            <span className="text-[10px] font-bold text-app-purple block">
              Lua Lock &lt; 1ms
            </span>
          </div>
        </div>

        {/* Card 4: DB Queue */}
        <div className="bg-white rounded-[24px] p-3.5 border border-purple-100/80 shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">DB Queue</span>
            <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <FiUsers className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-black text-slate-900 leading-none mb-1">
              {pendingOrders} <span className="text-[10px] text-slate-400 font-bold">Pending</span>
            </div>
            <span className="text-[10px] font-bold text-blue-600 block">
              10 Workers Standby
            </span>
          </div>
        </div>
      </div>

      {/* Waiting Room Gatekeeper Card */}
      <div className="bg-white rounded-[28px] p-4 shadow-card border border-purple-100/80 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-header-gradient flex items-center justify-center text-white shadow-btn shrink-0">
            <IoSparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-extrabold text-slate-900">
              Waiting Room Admission Gate
            </h3>
            <p className="text-[10px] text-slate-400">
              Admit users from waiting room in batches
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <div className="flex items-center gap-1.5 bg-[#F8F3FE] px-3 py-2 rounded-xl border border-purple-100 flex-1">
            <span className="text-[11px] font-bold text-slate-500">Batch:</span>
            <input
              type="number"
              min={1}
              max={100}
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              className="w-12 px-1 py-0.5 bg-white rounded-lg border border-purple-200 text-xs font-black text-center text-app-purple outline-none"
            />
            <span className="text-[11px] font-bold text-slate-500">Users</span>
          </div>

          <button
            onClick={handleAdmit}
            disabled={isAdmitting}
            className="px-4 py-2.5 bg-purple-btn text-white rounded-xl text-xs font-black shadow-btn hover:opacity-95 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {isAdmitting ? (
              <CgSpinner className="w-4 h-4 animate-spin" />
            ) : (
              <IoFlash className="w-3.5 h-3.5" />
            )}
            <span>Admit Users</span>
          </button>
        </div>

        {admitMsg && (
          <div
            className={`p-2.5 rounded-xl text-[11px] font-bold border flex items-center gap-1.5 ${
              admitMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            {admitMsg.type === 'success' ? (
              <FiCheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            ) : (
              <FiXCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
            )}
            <span>{admitMsg.text}</span>
          </div>
        )}
      </div>

      {/* Real-Time Orders List (Mobile Cards) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
            Live Transactions ({filteredOrders.length})
          </h3>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {(['ALL', 'CONFIRMED', 'PENDING'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all ${
                  statusFilter === st
                    ? 'bg-app-purple text-white shadow-sm'
                    : 'bg-white text-slate-500 border border-purple-100'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-[24px] p-8 text-center border border-purple-100 shadow-sm">
            <p className="text-xs font-bold text-slate-400">No orders found with status {statusFilter}.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredOrders.map((o) => (
              <div
                key={o.id}
                className="bg-white rounded-[22px] p-3.5 border border-purple-100 shadow-sm hover:shadow-card transition-all flex items-center justify-between gap-2"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-extrabold text-app-purple truncate max-w-[120px]">
                      {o.id}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                        o.status === 'CONFIRMED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : o.status === 'PENDING'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          o.status === 'CONFIRMED'
                            ? 'bg-emerald-500'
                            : o.status === 'PENDING'
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`}
                      ></span>
                      {o.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <span>{o.quantity} Tickets</span>
                    <span>•</span>
                    <span className="font-extrabold text-slate-800">{formatPrice(o.totalPrice)}</span>
                    <span>•</span>
                    <span>{new Date(o.createdAt).toLocaleTimeString('en-US')}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleViewLogs(o.id)}
                  className="px-2.5 py-1.5 bg-[#F8F3FE] hover:bg-purple-100 text-app-purple rounded-xl text-[10px] font-extrabold border border-purple-100 flex items-center gap-1 shrink-0"
                >
                  <FiFileText className="w-3 h-3" />
                  <span>Logs</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 🔍 SIMPLE & CLEAN AUDIT TRAIL MODAL WITH FULL SCREEN BACKDROP VIA PORTAL */}
      {selectedOrderLogs &&
        createPortal(
          <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
            <div className="relative w-full max-w-sm bg-white rounded-[32px] p-5 shadow-2xl border-4 border-white max-h-[85vh] flex flex-col justify-between overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-purple-50">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                    <FiFileText className="w-4 h-4 text-app-purple" />
                    <span>Audit Trail Logs</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[220px]">
                    Order ID: {selectedOrderId}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedOrderLogs(null)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>

              {/* Simple Log Items List */}
              <div className="overflow-y-auto no-scrollbar flex-1 py-3 space-y-2.5">
                {selectedOrderLogs.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs font-semibold">
                    No audit logs recorded for this order yet.
                  </div>
                ) : (
                  selectedOrderLogs.map((log, index) => {
                    const meta = getStepMeta(log.eventType);
                    return (
                      <div
                        key={log.id}
                        className="bg-[#F8F3FE] rounded-2xl p-3 border border-purple-100/80 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-[10px] text-app-purple bg-white px-2 py-0.5 rounded-md border border-purple-100">
                            {index + 1}. {log.eventType}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 flex items-center gap-0.5">
                            <FiClock className="w-2.5 h-2.5" />
                            {new Date(log.createdAt).toLocaleTimeString('en-US')}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600 font-medium leading-relaxed pt-0.5">
                          {meta.desc}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="pt-2 border-t border-purple-50">
                <button
                  onClick={() => setSelectedOrderLogs(null)}
                  className="w-full py-3 bg-purple-btn hover:opacity-95 text-white rounded-full text-xs font-black transition-all shadow-btn"
                >
                  Close Audit Log
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

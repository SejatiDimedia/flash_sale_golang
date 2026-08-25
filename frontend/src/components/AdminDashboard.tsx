import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiShield, FiUsers, FiDollarSign, FiActivity, FiRefreshCw, FiFileText, FiCheckCircle, FiXCircle, FiX, FiPlus, FiClock } from 'react-icons/fi';
import { HiTicket } from 'react-icons/hi2';
import { IoFlash } from 'react-icons/io5';
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
  const [gateMode, setGateMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [isTogglingMode, setIsTogglingMode] = useState(false);
  const [admitMsg, setAdmitMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CONFIRMED' | 'PENDING' | 'FAILED'>('ALL');

  const [selectedOrderLogs, setSelectedOrderLogs] = useState<OrderLog[] | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');

  useEffect(() => {
    if (events.length > 0 && !selectedEventId) {
      setSelectedEventId(events[0].id);
    }
  }, [events]);

  const fetchGateMode = async () => {
    if (!selectedEventId) return;
    try {
      const mode = await api.getGateMode(selectedEventId);
      setGateMode(mode);
    } catch (e) {
      // Default to AUTO
    }
  };

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
    fetchGateMode();
    const interval = setInterval(fetchOrders, 4000);
    return () => clearInterval(interval);
  }, [selectedEventId]);

  const handleToggleGateMode = async (newMode: 'AUTO' | 'MANUAL') => {
    if (!selectedEventId || isTogglingMode || gateMode === newMode) return;
    setIsTogglingMode(true);
    setAdmitMsg(null);
    try {
      const updated = await api.setGateMode(selectedEventId, newMode);
      setGateMode(updated);
      setAdmitMsg({
        type: 'success',
        text:
          newMode === 'AUTO'
            ? '🟢 Auto-Pass mode activated: Users can book directly without waiting in queue.'
            : '🔴 Traffic Surge mode activated: Users will queue in Waiting Room until admitted.',
      });
    } catch (e: any) {
      setAdmitMsg({ type: 'error', text: e.message || 'Failed to update gate mode' });
    } finally {
      setIsTogglingMode(false);
    }
  };

  const handleAdmit = async () => {
    if (!selectedEventId) return;
    setIsAdmitting(true);
    setAdmitMsg(null);
    try {
      const count = await api.admitUsers(selectedEventId, batchSize);
      setAdmitMsg({
        type: 'success',
        text: `Successfully admitted ${count} users from waiting room to checkout desk`,
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

      {/* 🎟️ WAITING ROOM ADMISSION GATEKEEPER & MODE SWITCH CARD */}
      <div className="bg-white rounded-[28px] p-4 shadow-card border border-purple-100/90 space-y-3.5 relative overflow-hidden">
        {/* Header with Live Status Tag */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-purple-100 text-app-purple flex items-center justify-center font-bold shrink-0">
              <FiUsers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 leading-tight">
                Waiting Room Gatekeeper
              </h3>
              <p className="text-[10px] text-slate-400 font-semibold">
                Control queue pacing & traffic surge
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border shrink-0 ${
              gateMode === 'AUTO'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                gateMode === 'AUTO' ? 'bg-emerald-500' : 'bg-pink-500 animate-ping'
              }`}
            ></span>
            <span>{gateMode === 'AUTO' ? 'Auto-Pass' : 'Surge Queue'}</span>
          </span>
        </div>

        {/* 🔄 MODE TOGGLE SWITCH: AUTO-PASS VS SURGE QUEUE */}
        <div className="bg-[#F8F3FE] p-1 rounded-2xl border border-purple-100 flex items-center gap-1">
          <button
            type="button"
            disabled={isTogglingMode}
            onClick={() => handleToggleGateMode('AUTO')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              gateMode === 'AUTO'
                ? 'bg-white text-emerald-700 shadow-sm border border-emerald-200'
                : 'text-slate-500 hover:text-app-purple'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                gateMode === 'AUTO' ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            ></span>
            <span>Auto-Pass (Direct)</span>
          </button>

          <button
            type="button"
            disabled={isTogglingMode}
            onClick={() => handleToggleGateMode('MANUAL')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              gateMode === 'MANUAL'
                ? 'bg-white text-app-purple shadow-sm border border-purple-200'
                : 'text-slate-500 hover:text-app-purple'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                gateMode === 'MANUAL' ? 'bg-pink-500 animate-pulse' : 'bg-slate-300'
              }`}
            ></span>
            <span>Surge Queue Gate</span>
          </button>
        </div>

        {/* 🟢 IF AUTO-PASS IS ACTIVE: Show Status Info */}
        {gateMode === 'AUTO' ? (
          <div className="p-3 bg-emerald-50/80 rounded-2xl border border-emerald-100 flex items-center gap-2.5 animate-fadeIn">
            <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <FiCheckCircle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-emerald-900">Direct Checkout Active</h4>
              <p className="text-[10px] text-emerald-700 font-semibold leading-tight">
                Users bypass the waiting room and proceed directly to ticket purchase.
              </p>
            </div>
          </div>
        ) : (
          /* 🔴 IF SURGE QUEUE IS ACTIVE: Show Manual Batch Release Controls */
          <div className="space-y-3 pt-1 animate-fadeIn">
            {/* Preset Quick Batch Buttons */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-700 mb-1.5">
                <span>Select Admission Batch:</span>
                <span className="text-app-purple font-black">{batchSize} Users / Batch</span>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {[5, 10, 25, 50, 100].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setBatchSize(preset)}
                    className={`py-1.5 rounded-xl text-xs font-black transition-all border text-center ${
                      batchSize === preset
                        ? 'bg-app-purple text-white border-app-purple shadow-sm scale-105'
                        : 'bg-[#F8F3FE] text-slate-600 border-purple-100 hover:border-purple-300'
                    }`}
                  >
                    +{preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Stepper + Big Action Button */}
            <div className="flex items-center gap-2 pt-0.5">
              <div className="flex items-center gap-1 bg-[#F8F3FE] p-1 rounded-2xl border border-purple-100 shrink-0">
                <button
                  onClick={() => setBatchSize(Math.max(1, batchSize - 5))}
                  className="w-8 h-8 rounded-xl bg-white text-app-purple font-black hover:bg-purple-100 flex items-center justify-center text-sm shadow-xs border border-purple-100"
                >
                  -
                </button>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={batchSize}
                  onChange={(e) =>
                    setBatchSize(Math.max(1, Math.min(100, Number(e.target.value))))
                  }
                  className="w-10 bg-transparent text-xs font-black text-center text-slate-800 outline-none"
                />
                <button
                  onClick={() => setBatchSize(Math.min(100, batchSize + 5))}
                  className="w-8 h-8 rounded-xl bg-white text-app-purple font-black hover:bg-purple-100 flex items-center justify-center text-sm shadow-xs border border-purple-100"
                >
                  +
                </button>
              </div>

              <button
                onClick={handleAdmit}
                disabled={isAdmitting || !selectedEventId}
                className="flex-1 py-3 bg-purple-btn text-white rounded-2xl text-xs font-black shadow-btn hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isAdmitting ? (
                  <>
                    <CgSpinner className="w-4 h-4 animate-spin" />
                    <span>Admitting Queue...</span>
                  </>
                ) : (
                  <>
                    <IoFlash className="w-4 h-4 text-amber-300" />
                    <span>Release {batchSize} Users to Checkout</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Feedback Alert */}
        {admitMsg && (
          <div
            className={`p-3 rounded-2xl text-xs font-bold border flex items-center gap-2 animate-fadeIn ${
              admitMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            {admitMsg.type === 'success' ? (
              <FiCheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <FiXCircle className="w-4 h-4 text-red-600 shrink-0" />
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

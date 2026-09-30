/**
 * Demo mode: WhatsApp/SMS are simulated and "Demo" labels are shown. Turn it off with
 * VITE_DEMO_MODE=false once real channels are connected.
 */
export const DEMO_MODE = import.meta.env["VITE_DEMO_MODE"] !== "false";

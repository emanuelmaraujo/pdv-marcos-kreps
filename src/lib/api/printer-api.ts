import { PrinterJob } from '@/types/pdv';
import { createClient } from '../supabase/client';

export const printerApi = {
  getTodayJobs: async (): Promise<PrinterJob[]> => {
    const supabase = createClient();
    
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('printer_jobs')
      .select(`
        *,
        order:orders(
          daily_number,
          status,
          payment_status,
          total_amount,
          customer_name
        )
      `)
      .gte('created_at', startOfDay.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  }
};

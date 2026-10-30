import { supabaseAdmin } from '../../config/supabase.js';

export const getMeasurements = async (req, res) => {
  const userId = req.user.id;
  const { data, error } = await supabaseAdmin
    .from('body_measurements')
    .select('*')
    .eq('user_id', userId)
    .order('measured_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

export const createMeasurement = async (req, res) => {
  const userId = req.user.id;
  const { data, error } = await supabaseAdmin
    .from('body_measurements')
    .insert([{ ...req.body, user_id: userId }])
    .select('*')
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
};

export const updateMeasurement = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { data, error } = await supabaseAdmin
    .from('body_measurements')
    .update(req.body)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

export const deleteMeasurement = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { error } = await supabaseAdmin
    .from('body_measurements')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return res.status(400).json({ error: error.message });
  res.status(204).send();
};
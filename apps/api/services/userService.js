const supabase = require('../db');

async function createUser({ email, hashedPassword, name }) {
  const { data, error } = await supabase
    .from('users')
    .insert([
      {
        email,
        password: hashedPassword,
        name,
      },
    ])
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function getUserByEmail(email) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .limit(1)
    .single();

  if (error) {
    // Supabase returns 406 when no rows found; normalize to null
    if (error.code === 'PGRST116') {
      return null;
    }

    throw error;
  }

  return data;
}

async function getUserById(id) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  return data;
}

module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
};

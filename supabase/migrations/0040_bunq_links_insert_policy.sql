create policy "Users insert their own bunq links"
  on bunq_payment_links for insert
  with check (auth.uid() = user_id);

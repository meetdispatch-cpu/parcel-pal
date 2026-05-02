CREATE POLICY "Admins can delete user_roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete profiles"
ON public.profiles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete their parcels"
ON public.parcels FOR DELETE TO authenticated
USING (auth.uid() = sender_id AND public.has_role(auth.uid(), 'admin'));
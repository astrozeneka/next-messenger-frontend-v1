"use client"

import { useForm } from 'react-hook-form';

export default function ClientForm() {
  const { register, handleSubmit } = useForm();

  const onSubmit = async (data: any) => {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    console.log(result);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <input
          {...register('name')}
          placeholder="Name"
          type="text"
        />
      </div>
      <div>
        <input
          {...register('email')}
          placeholder="Email"
          type="email"
        />
      </div>
      <button type="submit">Submit</button>
    </form>
  );
}
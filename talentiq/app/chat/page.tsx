'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Chat is embedded in the HR dashboard — redirect there
export default function ChatPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/hr/dashboard') }, [router])
  return null
}

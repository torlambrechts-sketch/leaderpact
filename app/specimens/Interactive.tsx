'use client'
import * as React from 'react'
import { OptionRow } from '@/components/lp/OptionRow'
import { RadioGroup } from '@/components/ui/radio-group'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Toaster, toast } from '@/components/ui/sonner'

/** The specimens that hold state: the answer options, the tabs, and a live toast. */
export function OptionsSpecimen({ question, options }: { question: string; options: Record<string, string> }) {
  const [value, setValue] = React.useState('4')
  return (
    <fieldset className="flex max-w-questionnaire flex-col gap-3">
      <legend className="mb-2 text-[15px] font-semibold">{question}</legend>
      <RadioGroup value={value} onValueChange={setValue} aria-label={question}>
        {Object.entries(options).map(([key, label]) => (
          <div key={key} data-specimen={key === '4' ? 'option-row-on' : key === '1' ? 'option-row-off' : undefined}>
            <OptionRow value={key} number={Number(key)} label={label} />
          </div>
        ))}
      </RadioGroup>
    </fieldset>
  )
}

export function TabsSpecimen({ label, tabs }: { label: string; tabs: { value: string; label: string; body: string }[] }) {
  return (
    <Tabs defaultValue={tabs[0]?.value}>
      <div data-specimen="tabs">
        <TabsList aria-label={label}>
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value} className="text-[13.5px] text-text-2 max-md:text-[15px]">
          {t.body}
        </TabsContent>
      ))}
    </Tabs>
  )
}

export function ToastTrigger({ label, message }: { label: string; message: string }) {
  return (
    <>
      <Toaster />
      <Button variant="secondary" size="small" onClick={() => toast.success(message)}>
        {label}
      </Button>
    </>
  )
}

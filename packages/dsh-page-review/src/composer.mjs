export function captureComposer(input) {
  if (input.claim || input.occurrences?.length)
    throw Error('当前输入含命令或引用，请先完成该输入，再预览发送注释')
  if (['adjudicating', 'submitting'].includes(input.phase))
    throw Error('当前输入正在提交，请稍后重试')
  return {
    text: input.draft || '',
    draftRev: input.draftRev,
    attachmentIds: [...(input.attachmentIds || [])],
  }
}

export function withComposerText(packet, capture) {
  return {
    ...packet,
    text: capture?.text?.trim()
      ? `用户补充要求：\n${capture.text}\n\n${packet.text}`
      : packet.text,
    ...(packet.displayText === undefined
      ? {}
      : {
          displayText: capture?.text?.trim()
            ? `${capture.text}\n\n${packet.displayText}`
            : packet.displayText,
        }),
  }
}

export async function composerAttachments(
  service,
  capture,
  sessionId,
  imageOffset,
) {
  const ids = capture?.attachmentIds || []
  if (!ids.length) return { content: [], pending: [] }
  const originals = service.resolveDraftAttachments(ids)
  if (originals.length !== ids.length)
    throw Error('输入框附件已变更，请重新预览')
  const { attachments: content } = await service.serializeDraftAttachments(ids)
  if (content.length !== ids.length)
    throw Error('输入框附件准备失败，请重新预览')
  const uploads = service.fileUploads.getSnapshot()
  const pending = originals.map((a, i) => {
    if (a.kind === 'image') {
      const block = content[i]
      return {
        type: 'image',
        value: {
          previewUrl: `data:${block.mediaType};base64,${block.data}`,
          name: a.file.name,
          width: a.width,
          height: a.height,
        },
      }
    }
    const upload = uploads[a.id]
    if (upload?.status !== 'ready') throw Error('请等待输入框附件上传完成')
    return { type: 'file', value: upload.file }
  })
  return {
    content,
    pending,
    onRetire: (settlement) =>
      service.settleSubmittedAttachments(sessionId, originals, {
        ...settlement,
        attachments: (settlement.attachments || []).slice(imageOffset),
      }),
  }
}

export function retireComposer(capture, current, actions) {
  if (capture.draftRev === current.draftRev && capture.text === current.draft)
    actions.setDraft('')
  actions.pruneAttachments(capture.attachmentIds)
}

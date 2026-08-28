import {
  parseReadyListFocus,
  READY_LIST_FOCUS,
  readyListFocusToWorklist,
  readyListPath,
} from '@/lib/constants/ready-list-focus'

describe('ready list focus', () => {
  it('treats pickup and desk aliases as the counter / Pickup-desk preset', () => {
    expect(parseReadyListFocus('counter')).toBe(READY_LIST_FOCUS.COUNTER)
    expect(parseReadyListFocus('pickup')).toBe(READY_LIST_FOCUS.COUNTER)
    expect(parseReadyListFocus('desk')).toBe(READY_LIST_FOCUS.COUNTER)
    expect(parseReadyListFocus('not_released')).toBe(READY_LIST_FOCUS.SHELF)
    expect(parseReadyListFocus('nope')).toBe(READY_LIST_FOCUS.ALL)
    expect(parseReadyListFocus(null)).toBe(READY_LIST_FOCUS.ALL)
  })

  it('narrows worklist status for counter and shelf without inventing a pickup page', () => {
    expect(readyListFocusToWorklist(READY_LIST_FOCUS.COUNTER)).toEqual({
      statusNarrow: ['ready_for_pickup'],
    })
    expect(readyListFocusToWorklist(READY_LIST_FOCUS.SHELF)).toEqual({
      statusNarrow: ['ready'],
    })
    expect(readyListFocusToWorklist(READY_LIST_FOCUS.COLLECTION)).toEqual({
      collectionDue: true,
    })
    expect(readyListFocusToWorklist(READY_LIST_FOCUS.NO_RACK)).toEqual({
      missingRack: true,
    })
    expect(readyListPath(READY_LIST_FOCUS.COUNTER)).toBe('/dashboard/ready?focus=counter')
    expect(readyListPath()).toBe('/dashboard/ready')
  })
})

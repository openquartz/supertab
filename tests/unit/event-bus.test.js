const EventBus = require('../../background/event-bus');

describe('EventBus', () => {
  let eventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  test('should register and emit events', () => {
    const callback = jest.fn();
    eventBus.on('test-event', callback);
    eventBus.emit('test-event', { data: 'test' });
    expect(callback).toHaveBeenCalledWith({ data: 'test' });
  });

  test('should handle multiple listeners for same event', () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    eventBus.on('multi-event', callback1);
    eventBus.on('multi-event', callback2);
    eventBus.emit('multi-event');
    expect(callback1).toHaveBeenCalled();
    expect(callback2).toHaveBeenCalled();
  });

  test('should remove specific listener with off method', () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    eventBus.on('remove-test', callback1);
    eventBus.on('remove-test', callback2);

    eventBus.off('remove-test', callback1);
    eventBus.emit('remove-test');

    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalled();
  });

  test('should handle emit with no listeners gracefully', () => {
    expect(() => {
      eventBus.emit('non-existent-event', { data: 'test' });
    }).not.toThrow();
  });

  test('should remove all listeners for specific event', () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    eventBus.on('clear-test', callback1);
    eventBus.on('clear-test', callback2);

    eventBus.removeAllListeners('clear-test');
    eventBus.emit('clear-test');

    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).not.toHaveBeenCalled();
  });

  test('should remove all listeners when no event specified', () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    eventBus.on('event1', callback1);
    eventBus.on('event2', callback2);

    eventBus.removeAllListeners();
    eventBus.emit('event1');
    eventBus.emit('event2');

    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).not.toHaveBeenCalled();
  });

  test('should handle listener errors gracefully', () => {
    const errorCallback = jest.fn(() => {
      throw new Error('Test error');
    });
    const normalCallback = jest.fn();

    eventBus.on('error-test', errorCallback);
    eventBus.on('error-test', normalCallback);

    expect(() => {
      eventBus.emit('error-test');
    }).not.toThrow();

    expect(normalCallback).toHaveBeenCalled();
  });
});
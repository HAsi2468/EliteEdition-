// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  processInputMath,
  handleGlobalEnterAsTab,
  switchActiveSubTab,
  activateSidebarModule,
  cyclePanes,
} from './navigationHelpers';

describe('Navigation Helpers Unit Tests', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('processInputMath', () => {
    it('evaluates arithmetic expressions inline and triggers events', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = '150 * 12';
      document.body.appendChild(input);

      let changeFired = false;
      input.addEventListener('change', () => {
        changeFired = true;
      });

      const processed = processInputMath(input);
      expect(processed).toBe(true);
      expect(input.value).toBe('1800');
      expect(changeFired).toBe(true);
    });

    it('evaluates percentage expressions correctly (1000 - 10%)', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = '1000 - 10%';
      document.body.appendChild(input);

      const processed = processInputMath(input);
      expect(processed).toBe(true);
      expect(input.value).toBe('900');
    });

    it('ignores plain numbers without operators', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = '450.50';
      document.body.appendChild(input);

      const processed = processInputMath(input);
      expect(processed).toBe(false);
      expect(input.value).toBe('450.50');
    });
  });

  describe('handleGlobalEnterAsTab', () => {
    it('moves focus from first input to second input on Enter', () => {
      const form = document.createElement('form');
      const input1 = document.createElement('input');
      const input2 = document.createElement('input');
      form.appendChild(input1);
      form.appendChild(input2);
      document.body.appendChild(form);

      // In JSDOM, elements need offsetWidth / offsetHeight or mock
      Object.defineProperty(input1, 'offsetWidth', { value: 100 });
      Object.defineProperty(input1, 'offsetHeight', { value: 30 });
      Object.defineProperty(input2, 'offsetWidth', { value: 100 });
      Object.defineProperty(input2, 'offsetHeight', { value: 30 });

      input1.focus();
      expect(document.activeElement).toBe(input1);

      const enterEvt = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      const handled = handleGlobalEnterAsTab(enterEvt);

      expect(handled).toBe(true);
      expect(document.activeElement).toBe(input2);
    });

    it('moves focus backward on Shift+Enter', () => {
      const form = document.createElement('form');
      const input1 = document.createElement('input');
      const input2 = document.createElement('input');
      form.appendChild(input1);
      form.appendChild(input2);
      document.body.appendChild(form);

      Object.defineProperty(input1, 'offsetWidth', { value: 100 });
      Object.defineProperty(input1, 'offsetHeight', { value: 30 });
      Object.defineProperty(input2, 'offsetWidth', { value: 100 });
      Object.defineProperty(input2, 'offsetHeight', { value: 30 });

      input2.focus();
      expect(document.activeElement).toBe(input2);

      const shiftEnterEvt = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true });
      const handled = handleGlobalEnterAsTab(shiftEnterEvt);

      expect(handled).toBe(true);
      expect(document.activeElement).toBe(input1);
    });
  });

  describe('switchActiveSubTab', () => {
    it('cycles sub-tab buttons when requested', () => {
      const main = document.createElement('div');
      main.id = 'main-content-area';

      const tabBar = document.createElement('div');
      tabBar.className = 'inv-sub-tab-bar';

      const tab1 = document.createElement('button');
      tab1.className = 'ent-tab-btn active';
      tab1.textContent = 'Tab 1';

      const tab2 = document.createElement('button');
      tab2.className = 'ent-tab-btn';
      tab2.textContent = 'Tab 2';

      Object.defineProperty(tab1, 'offsetWidth', { value: 80 });
      Object.defineProperty(tab1, 'offsetHeight', { value: 30 });
      Object.defineProperty(tab2, 'offsetWidth', { value: 80 });
      Object.defineProperty(tab2, 'offsetHeight', { value: 30 });

      tabBar.appendChild(tab1);
      tabBar.appendChild(tab2);
      main.appendChild(tabBar);
      document.body.appendChild(main);

      let clickedTab2 = false;
      tab2.addEventListener('click', () => {
        clickedTab2 = true;
      });

      const switched = switchActiveSubTab('next');
      expect(switched).toBe(true);
      expect(clickedTab2).toBe(true);
    });
  });

  describe('activateSidebarModule', () => {
    it('activates the nth visible sidebar module', () => {
      const sidebar = document.createElement('aside');
      sidebar.id = 'erp-sidebar-nav';

      const btn1 = document.createElement('button');
      btn1.setAttribute('data-sidebar-nav', 'true');
      const btn2 = document.createElement('button');
      btn2.setAttribute('data-sidebar-nav', 'true');

      sidebar.appendChild(btn1);
      sidebar.appendChild(btn2);
      document.body.appendChild(sidebar);

      let clickedBtn2 = false;
      btn2.addEventListener('click', () => {
        clickedBtn2 = true;
      });

      const activated = activateSidebarModule(1);
      expect(activated).toBe(true);
      expect(clickedBtn2).toBe(true);
    });
  });
});
